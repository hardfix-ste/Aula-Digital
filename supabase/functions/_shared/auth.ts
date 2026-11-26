import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export type Caller = {
  userId: string
  institutionId: string
  roles: string[]
  admin: SupabaseClient   // cliente con service role (solo dentro de la función)
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/** Verifica el JWT del llamante y devuelve su institución y roles (leídos de la base). */
export async function authenticate(req: Request): Promise<Caller> {
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new HttpError(401, 'Falta el token de sesión')

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) throw new HttpError(401, 'Sesión inválida o vencida')

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles')
    .select('institution_id,status').eq('id', user.id).single()
  if (!profile || profile.status !== 'active') throw new HttpError(403, 'Usuario inactivo')
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id)
  return {
    userId: user.id,
    institutionId: profile.institution_id,
    roles: (roles ?? []).map((r: { role: string }) => r.role),
    admin,
  }
}

export function requireRole(caller: Caller, allowed: string[]) {
  if (!caller.roles.some((r) => allowed.includes(r))) throw new HttpError(403, 'No tenés permiso para esta operación')
}
