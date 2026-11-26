import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Invoca la Edge Function admin-users y traduce los errores a mensajes legibles. */
export async function callAdminUsers<T = { ok: boolean }>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let msg = 'No se pudo comunicar con el servidor. Verificá que la función esté desplegada.'
    if (error instanceof FunctionsHttpError) {
      try {
        const j = await error.context.json()
        if (j?.error) msg = String(j.error)
      } catch { /* respuesta sin JSON */ }
    }
    throw new Error(msg)
  }
  return data as T
}
