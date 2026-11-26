import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { GraduationCap, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { configMissing } from '../lib/supabase'

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 to-brand-600 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 sm:p-8">
        <div className="mb-6 text-center">
          <GraduationCap className="mx-auto mb-2 h-10 w-10 text-brand-600" />
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{message}</p>
}

export function ConfigMissingScreen() {
  return (
    <AuthShell title="Falta la configuración" subtitle="AULA DIGITAL no puede conectarse a Supabase">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Definí <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (archivo <code>.env.local</code> en
        desarrollo o variables de Actions en GitHub). Los pasos están en el README.
      </p>
    </AuthShell>
  )
}

export function LoginPage() {
  const { session, profile, signIn, profileError } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (configMissing) return <ConfigMissingScreen />
  if (session && profile) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const err = await signIn(email, password)
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <AuthShell title="AULA DIGITAL" subtitle="Ingresá con tu usuario institucional">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Correo electrónico</label>
          <input id="email" type="email" required autoComplete="username" className="input"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Contraseña</label>
          <input id="password" type="password" required autoComplete="current-password" className="input"
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorBox message={error ?? profileError} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ingresar
        </button>
        <p className="text-center text-sm"><Link className="text-brand-600 hover:underline" to="/recuperar">Olvidé mi contraseña</Link></p>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const err = await requestPasswordReset(email)
    if (err) setError(err); else setSent(true)
    setBusy(false)
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un enlace por correo">
      {sent ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Si el correo corresponde a una cuenta, vas a recibir un enlace para crear una nueva contraseña. Revisá también la carpeta de spam.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Correo electrónico</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <ErrorBox message={error} />
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enviar enlace
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link className="text-brand-600 hover:underline" to="/login">Volver a ingresar</Link></p>
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const { session, loading, updatePassword, clearRecovery, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 10) { setError('La contraseña debe tener al menos 10 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true); setError(null)
    const err = await updatePassword(password)
    if (err) { setError(err); setBusy(false); return }
    clearRecovery()
    await signOut()
    navigate('/login', { replace: true })
  }

  if (!loading && !session) {
    return (
      <AuthShell title="Enlace inválido" subtitle="El enlace venció o ya fue usado">
        <Link className="btn-primary w-full" to="/recuperar">Pedir un enlace nuevo</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elegí una contraseña de al menos 10 caracteres">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="pw" className="label">Nueva contraseña</label>
          <input id="pw" type="password" required autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pw2" className="label">Repetir contraseña</label>
          <input id="pw2" type="password" required autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <ErrorBox message={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar contraseña
        </button>
      </form>
    </AuthShell>
  )
}

/** Si Supabase indica recuperación de contraseña, lleva al formulario correspondiente. */
export function RecoveryRedirect() {
  const { recovery } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { if (recovery) navigate('/restablecer', { replace: true }) }, [recovery, navigate])
  return null
}
