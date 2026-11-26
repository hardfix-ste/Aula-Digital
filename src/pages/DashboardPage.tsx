import { useEffect, useState } from 'react'
import { GraduationCap, Layers, Users, UserCog } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { isStaff } from '../lib/roles'
import { Spinner } from '../components/Spinner'

interface Stats { students: number; teachers: number | null; divisions: number; users: number | null }
interface DivisionBar { name: string; alumnos: number }

export function DashboardPage() {
  const { profile, roles, institution } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [bars, setBars] = useState<DivisionBar[]>([])
  const [error, setError] = useState<string | null>(null)
  const staff = isStaff(roles)
  const canSeeRoles = roles.includes('superadmin') || roles.includes('directivo')

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Todas las consultas pasan por RLS: cada rol solo recibe lo que puede ver.
      const [students, divisions, teachers, users, enr] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'activo'),
        supabase.from('divisions').select('id', { count: 'exact', head: true }),
        canSeeRoles ? supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'docente') : Promise.resolve(null),
        canSeeRoles ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active') : Promise.resolve(null),
        staff
          ? supabase.from('enrollments').select('division_id, divisions(name, courses(name))').neq('status', 'baja')
          : Promise.resolve(null),
      ])
      if (cancelled) return
      if (students.error || divisions.error) { setError('No se pudieron cargar las estadísticas.'); return }
      setStats({
        students: students.count ?? 0,
        divisions: divisions.count ?? 0,
        teachers: teachers ? (teachers.count ?? 0) : null,
        users: users ? (users.count ?? 0) : null,
      })
      if (enr && !enr.error && enr.data) {
        const counts = new Map<string, number>()
        for (const row of enr.data as unknown as { divisions: { name: string; courses: { name: string } | null } | null }[]) {
          const label = row.divisions ? `${row.divisions.courses?.name ?? ''} ${row.divisions.name}`.trim() : 'Sin curso'
          counts.set(label, (counts.get(label) ?? 0) + 1)
        }
        setBars([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([name, alumnos]) => ({ name, alumnos })))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [staff, canSeeRoles])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!stats) return <Spinner />

  const cards = [
    { label: staff ? 'Alumnos activos' : 'Mis alumnos', value: stats.students, icon: GraduationCap },
    { label: 'Divisiones', value: stats.divisions, icon: Layers },
    ...(stats.teachers !== null ? [{ label: 'Docentes', value: stats.teachers, icon: Users }] : []),
    ...(stats.users !== null ? [{ label: 'Usuarios activos', value: stats.users, icon: UserCog }] : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Hola, {profile?.first_name}</h1>
        <p className="text-sm text-slate-500">{institution?.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className="rounded-lg bg-brand-50 p-3 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300"><Icon className="h-6 w-6" /></div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {staff && (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold">Alumnos inscriptos por curso y división</h2>
          {bars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Todavía no hay alumnos inscriptos. Cuando se carguen inscripciones, el gráfico se completa solo.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="alumnos" name="Alumnos" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
