// Edge Function: admin-users
// Operaciones de administración de usuarios que requieren service role.
// Solo el SUPERADMINISTRADOR puede invocarla. Los permisos se verifican en el servidor.
import { corsHeaders, json } from '../_shared/cors.ts'
import { authenticate, requireRole, HttpError } from '../_shared/auth.ts'

const ROLES = ['superadmin', 'directivo', 'secretaria', 'docente', 'familia']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function validRoles(v: unknown): string[] {
  if (!Array.isArray(v) || v.length === 0) throw new HttpError(400, 'Indicá al menos un rol')
  const roles = [...new Set(v.map(String))]
  if (roles.some((r) => !ROLES.includes(r))) throw new HttpError(400, 'Rol inválido')
  return roles
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido')
    const caller = await authenticate(req)
    requireRole(caller, ['superadmin'])
    const { admin, institutionId, userId } = caller
    const body = await req.json().catch(() => ({}))
    const action = str(body.action, 30)

    // Verifica que el usuario objetivo pertenezca a la misma institución
    async function targetInInstitution(id: string) {
      const { data } = await admin.from('profiles').select('id,institution_id').eq('id', id).single()
      if (!data || data.institution_id !== institutionId) throw new HttpError(404, 'Usuario no encontrado')
    }
    async function otherSuperadmins(excluding: string) {
      const { count } = await admin.from('user_roles').select('id', { count: 'exact', head: true })
        .eq('role', 'superadmin').eq('institution_id', institutionId).neq('user_id', excluding)
      return count ?? 0
    }

    if (action === 'create') {
      const email = str(body.email, 200).toLowerCase()
      const password = typeof body.password === 'string' ? body.password : ''
      const firstName = str(body.first_name)
      const lastName = str(body.last_name)
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Correo electrónico inválido')
      if (password.length < 10) throw new HttpError(400, 'La contraseña debe tener al menos 10 caracteres')
      if (!firstName || !lastName) throw new HttpError(400, 'Nombre y apellido son obligatorios')
      const roles = validRoles(body.roles)

      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      })
      if (error || !created.user) throw new HttpError(400, error?.message ?? 'No se pudo crear el usuario')
      const uid = created.user.id

      const { error: pErr } = await admin.from('profiles').insert({
        id: uid, institution_id: institutionId, first_name: firstName, last_name: lastName,
        dni: str(body.dni, 12) || null, phone: str(body.phone, 40) || null,
      })
      if (!pErr) {
        const { error: rErr } = await admin.from('user_roles')
          .insert(roles.map((role) => ({ user_id: uid, institution_id: institutionId, role })))
        if (rErr) { await admin.auth.admin.deleteUser(uid); throw new HttpError(400, rErr.message) }
      } else {
        await admin.auth.admin.deleteUser(uid)   // evita usuarios huérfanos
        throw new HttpError(400, pErr.message)
      }
      return json(req, { ok: true, user_id: uid }, 201)
    }

    if (action === 'set_status') {
      const id = str(body.user_id, 40)
      const status = str(body.status, 20)
      if (!['active', 'suspended'].includes(status)) throw new HttpError(400, 'Estado inválido')
      await targetInInstitution(id)
      if (id === userId) throw new HttpError(400, 'No podés suspender tu propia cuenta')
      const { error } = await admin.from('profiles').update({ status }).eq('id', id)
      if (error) throw new HttpError(400, error.message)
      // Bloquea/desbloquea el inicio de sesión en Auth
      await admin.auth.admin.updateUserById(id, { ban_duration: status === 'suspended' ? '876000h' : 'none' })
      return json(req, { ok: true })
    }

    if (action === 'set_roles') {
      const id = str(body.user_id, 40)
      const roles = validRoles(body.roles)
      await targetInInstitution(id)
      if (!roles.includes('superadmin') && (await otherSuperadmins(id)) === 0) {
        throw new HttpError(400, 'Tiene que quedar al menos un superadministrador')
      }
      await admin.from('user_roles').delete().eq('user_id', id).eq('institution_id', institutionId)
      const { error } = await admin.from('user_roles')
        .insert(roles.map((role) => ({ user_id: id, institution_id: institutionId, role })))
      if (error) throw new HttpError(400, error.message)
      return json(req, { ok: true })
    }

    if (action === 'delete') {
      const id = str(body.user_id, 40)
      await targetInInstitution(id)
      if (id === userId) throw new HttpError(400, 'No podés eliminar tu propia cuenta')
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) throw new HttpError(400, 'No se pudo eliminar. Si el usuario tiene datos asociados, suspendelo en su lugar.')
      return json(req, { ok: true })
    }

    throw new HttpError(400, 'Acción desconocida')
  } catch (e) {
    if (e instanceof HttpError) return json(req, { error: e.message }, e.status)
    console.error(e)
    return json(req, { error: 'Error interno' }, 500)
  }
})
