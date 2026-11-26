import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true si faltan las variables de entorno públicas de Supabase */
export const configMissing = !url || !anonKey

// Solo se usa la clave pública (anon/publishable). La service_role NUNCA va en el frontend.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
