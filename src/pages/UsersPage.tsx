import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { KeyRound, Loader2, Pencil, Plus, Search, Trash2, UserCheck, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { callAdminUsers } from '../lib/adminUsers'
import { ALL_ROLES, ROLE_LABELS } from '../lib/roles'
import { fullName } from '../lib/format'
import type { AppRole, UserRow } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Modal } from '../components/Modal'
import { Spinner } from '../components/Spinner'

interface FormState { email: string; password: string; first_name: string; last_name: string; dni: string; phone: string; roles: AppRole[] }
const EMPTY: FormState = { email: '', password: '', first_name: '', last_name: '', dni: '', phone: '', roles: ['docente'] }

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint32Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function RoleChecks({ value, onChange }: { value: AppRole[]; onChange: (r: AppRole[]) => void }) {
  return (
    <fieldset>
      <legend className="label">Roles</legend>
      <div className="grid grid-cols-2 gap-2">
        {ALL_ROLES.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.includes(r)}
                   onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
            {ROLE_LABELS[r]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function UsersPage() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<UserRow[] | null>(null)
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<AppRole | ''>('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => Promise<void> } | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      supabase.from('profiles').select('*').order('last_name'),
      supabase.from('user_roles').select('user_id, role'),
    ])
    if (p.error || r.error) { toast.error('No se pudo cargar la lista de usuarios.'); setRows([]); return }
    const byUser = new Map<string, AppRole[]>()
    for (const x of r.data ?? []) byUser.set(x.user_id, [...(byUser.get(x.user_id) ?? []), x.role as AppRole])
    setRows((p.data ?? []).map((u) => ({ ...(u as UserRow), roles: byUser.get(u.id) ?? [] })))
  }, [toast])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (rows ?? []).filter((u) =>
      (!roleFilter || u.roles.includes(roleFilter)) &&
      (!term || `${u.first_name} ${u.last_name} ${u.dni ?? ''}`.toLowerCase().includes(term)))
  }, [rows, q, roleFilter])

  async function run(fn: () => Promise<void>, okMsg: string) {
    setBusy(true)
    try { await fn(); toast.success(okMsg); await load() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ocurrió un error.') }
    finally { setBusy(false) }
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault()
    if (form.roles.length === 0) { toast.error('Elegí al menos un rol.'); return }
    if (form.password.length < 10) { toast.error('La contraseña debe tener al menos 10 caracteres.'); return }
    await run(async () => {
      await callAdminUsers({ action: 'create', ...form })
      setCreating(false); setForm(EMPTY)
    }, 'Usuario creado. Entregale la contraseña inicial de forma segura.')
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (form.roles.length === 0) { toast.error('Elegí al menos un rol.'); return }
    await run(async () => {
      const { data, error } = await supabase.from('profiles').update({
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        dni: form.dni.trim() || null, phone: form.phone.trim() || null,
      }).eq('id', editing.id).select('id')
      if (error || !data?.length) throw new Error('No se pudieron guardar los datos del usuario.')
      const same = [...form.roles].sort().join() === [...editing.roles].sort().join()
      if (!same) await callAdminUsers({ action: 'set_roles', user_id: editing.id, roles: form.roles })
      setEditing(null)
    }, 'Usuario actualizado.')
  }

  function openEdit(u: UserRow) {
    setForm({ ...EMPTY, first_name: u.first_name, last_name: u.last_name, dni: u.dni ?? '', phone: u.phone ?? '', roles: u.roles })
    setEditing(u)
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  if (!rows) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Usuarios</h1>
          <p className="text-sm text-slate-500">Alta, roles y suspensión de cuentas.</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ ...EMPTY, password: generatePassword() }); setCreating(true) }}>
          <Plus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar por nombre, apellido o DNI" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar usuarios" />
        </div>
        <select className="input sm:w-52" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as AppRole | '')} aria-label="Filtrar por rol">
          <option value="">Todos los roles</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr><th className="th">Usuario</th><th className="th">Roles</th><th className="th">Estado</th><th className="th text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="td py-10 text-center text-slate-500">No hay usuarios que coincidan con la búsqueda.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="td"><p className="font-medium">{fullName(u)}</p><p className="text-xs text-slate-500">{u.dni ? `DNI ${u.dni}` : 'Sin DNI cargado'}</p></td>
                <td className="td"><div className="flex flex-wrap gap-1">
                  {u.roles.map((r) => <span key={r} className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{ROLE_LABELS[r]}</span>)}
                </div></td>
                <td className="td">
                  <span className={`badge ${u.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                    {u.status === 'active' ? 'Activo' : 'Suspendido'}
                  </span>
                </td>
                <td className="td"><div className="flex justify-end gap-1">
                  <button className="btn-ghost px-2" onClick={() => openEdit(u)} aria-label={`Editar a ${fullName(u)}`}><Pencil className="h-4 w-4" /></button>
                  {u.id !== me?.id && (<>
                    <button className="btn-ghost px-2" aria-label={u.status === 'active' ? `Suspender a ${fullName(u)}` : `Reactivar a ${fullName(u)}`}
                      onClick={() => setConfirm({
                        title: u.status === 'active' ? 'Suspender usuario' : 'Reactivar usuario',
                        message: u.status === 'active'
                          ? `${fullName(u)} no podrá iniciar sesión hasta que lo reactives. Sus datos se conservan.`
                          : `${fullName(u)} volverá a poder iniciar sesión.`,
                        label: u.status === 'active' ? 'Suspender' : 'Reactivar',
                        run: () => run(async () => { await callAdminUsers({ action: 'set_status', user_id: u.id, status: u.status === 'active' ? 'suspended' : 'active' }) },
                          u.status === 'active' ? 'Usuario suspendido.' : 'Usuario reactivado.'),
                      })}>
                      {u.status === 'active' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
                    <button className="btn-ghost px-2 text-red-600" aria-label={`Eliminar a ${fullName(u)}`}
                      onClick={() => setConfirm({
                        title: 'Eliminar usuario',
                        message: `Se eliminará la cuenta de ${fullName(u)}. Esta acción no se puede deshacer. Si solo querés impedir su acceso, suspendelo.`,
                        label: 'Eliminar',
                        run: () => run(async () => { await callAdminUsers({ action: 'delete', user_id: u.id }) }, 'Usuario eliminado.'),
                      })}><Trash2 className="h-4 w-4" /></button>
                  </>)}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={creating} title="Nuevo usuario" onClose={() => setCreating(false)}>
        <form id="create-user" onSubmit={submitCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="u-fn">Nombre</label><input id="u-fn" className="input" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
            <div><label className="label" htmlFor="u-ln">Apellido</label><input id="u-ln" className="input" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></div>
          </div>
          <div><label className="label" htmlFor="u-em">Correo electrónico</label><input id="u-em" type="email" className="input" required value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="u-dni">DNI</label><input id="u-dni" className="input" inputMode="numeric" value={form.dni} onChange={(e) => set('dni', e.target.value.replace(/\D/g, ''))} /></div>
            <div><label className="label" htmlFor="u-ph">Teléfono</label><input id="u-ph" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          </div>
          <div>
            <label className="label" htmlFor="u-pw">Contraseña inicial</label>
            <div className="flex gap-2">
              <input id="u-pw" className="input font-mono" required minLength={10} value={form.password} onChange={(e) => set('password', e.target.value)} />
              <button type="button" className="btn-secondary px-3" onClick={() => set('password', generatePassword())} aria-label="Generar contraseña"><KeyRound className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Mínimo 10 caracteres. El usuario puede cambiarla con “Olvidé mi contraseña”.</p>
          </div>
          <RoleChecks value={form.roles} onChange={(r) => set('roles', r)} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancelar</button>
            <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear usuario</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} title="Editar usuario" onClose={() => setEditing(null)}>
        <form onSubmit={submitEdit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="e-fn">Nombre</label><input id="e-fn" className="input" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} /></div>
            <div><label className="label" htmlFor="e-ln">Apellido</label><input id="e-ln" className="input" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="e-dni">DNI</label><input id="e-dni" className="input" inputMode="numeric" value={form.dni} onChange={(e) => set('dni', e.target.value.replace(/\D/g, ''))} /></div>
            <div><label className="label" htmlFor="e-ph">Teléfono</label><input id="e-ph" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          </div>
          <RoleChecks value={form.roles} onChange={(r) => set('roles', r)} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirm} title={confirm?.title ?? ''} onClose={() => setConfirm(null)}
        footer={<>
          <button className="btn-secondary" onClick={() => setConfirm(null)}>Cancelar</button>
          <button className="btn-danger" disabled={busy} onClick={async () => { const c = confirm; setConfirm(null); if (c) await c.run() }}>{confirm?.label}</button>
        </>}>
        <p className="text-sm">{confirm?.message}</p>
      </Modal>
    </div>
  )
}
