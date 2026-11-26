export type AppRole = 'superadmin' | 'directivo' | 'secretaria' | 'docente' | 'familia'

export interface Profile {
  id: string
  institution_id: string
  first_name: string
  last_name: string
  dni: string | null
  phone: string | null
  status: 'active' | 'suspended'
  created_at: string
}

export interface Institution {
  id: string
  name: string
  cue: string | null
  cuit: string | null
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
  logo_path: string | null
}

export interface InstitutionalSettings {
  institution_id: string
  attendance_mode: 'diaria' | 'por_materia'
  absence_alert_percent: number
  absence_alert_count: number
  family_portal_enabled: boolean
  ai_enabled: boolean
  ai_provider: 'anthropic' | 'openai' | 'google'
  ai_model: string | null
}

export interface UserRow extends Profile {
  roles: AppRole[]
}
