import type { AppRole } from './types'

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'Superadministrador',
  directivo: 'Directivo',
  secretaria: 'Secretaría',
  docente: 'Docente',
  familia: 'Familia',
}

export const ALL_ROLES: AppRole[] = ['superadmin', 'directivo', 'secretaria', 'docente', 'familia']

export type ModuleKey = 'dashboard' | 'usuarios' | 'configuracion'

/** Roles con acceso a cada módulo. La seguridad real está en RLS: esto solo ordena la interfaz. */
export const MODULE_ACCESS: Record<ModuleKey, AppRole[]> = {
  dashboard: ['superadmin', 'directivo', 'secretaria', 'docente', 'familia'],
  usuarios: ['superadmin'],
  configuracion: ['superadmin'],
}

export function hasAnyRole(userRoles: AppRole[], allowed: AppRole[]): boolean {
  return userRoles.some((r) => allowed.includes(r))
}

export function canAccess(module: ModuleKey, userRoles: AppRole[]): boolean {
  return hasAnyRole(userRoles, MODULE_ACCESS[module])
}

/** Personal con lectura transversal (espeja public.is_staff() en la base) */
export function isStaff(userRoles: AppRole[]): boolean {
  return hasAnyRole(userRoles, ['superadmin', 'directivo', 'secretaria'])
}
