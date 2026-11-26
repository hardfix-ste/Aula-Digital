import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AppRole, Institution, InstitutionalSettings, Profile } from '../lib/types'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: Profile | null
  roles: AppRole[]
  institution: Institution | null
  settings: InstitutionalSettings | null
  profileError: string | null
  recovery: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  reload: () => Promise<void>
  clearRecovery: () => void
}

const AuthCtx = createContext<AuthState | null>(null)

function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Tu correo todavía no fue confirmado.'
  if (m.includes('banned') || m.includes('user is banned')) return 'Tu cuenta está suspendida. Comunicate con la institución.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.'
  if (m.includes('password should be at least')) return 'La contraseña es demasiado corta.'
  if (m.includes('same password')) return 'La nueva contraseña debe ser distinta de la anterior.'
  return 'No se pudo completar la operación. Intentá de nuevo.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<AppRole[]>([])
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [settings, setSettings] = useState<InstitutionalSettings | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id ?? null

  const load = useCallback(async (userId: string) => {
    const [p, r] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ])
    if (p.error || r.error) {
      setProfileError('No se pudieron cargar tus datos. Revisá tu conexión e intentá de nuevo.')
      return
    }
    if (!p.data) {
      setProfileError('Tu usuario no tiene un perfil en AULA DIGITAL. Pedile al administrador que lo cree.')
      return
    }
    if (p.data.status !== 'active') {
      setProfileError('Tu cuenta está suspendida. Comunicate con la institución.')
      await supabase.auth.signOut()
      return
    }
    const [inst, st] = await Promise.all([
      supabase.from('institutions').select('*').maybeSingle(),
      supabase.from('institutional_settings').select('*').maybeSingle(),
    ])
    setProfile(p.data as Profile)
    setRoles((r.data ?? []).map((x) => x.role as AppRole))
    setInstitution((inst.data as Institution | null) ?? null)
    setSettings((st.data as InstitutionalSettings | null) ?? null)
    setProfileError(null)
  }, [])

  useEffect(() => {
    if (!sessionReady) return
    if (!uid) {
      setProfile(null); setRoles([]); setInstitution(null); setSettings(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    load(uid).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [uid, sessionReady, load])

  const value = useMemo<AuthState>(() => ({
    loading, session, profile, roles, institution, settings, profileError, recovery,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return error ? translateAuthError(error.message) : null
    },
    signOut: async () => { await supabase.auth.signOut() },
    requestPasswordReset: async (email) => {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      return error ? translateAuthError(error.message) : null
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password })
      return error ? translateAuthError(error.message) : null
    },
    reload: async () => { if (uid) await load(uid) },
    clearRecovery: () => setRecovery(false),
  }), [loading, session, profile, roles, institution, settings, profileError, recovery, uid, load])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
