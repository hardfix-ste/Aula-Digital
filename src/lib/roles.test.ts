import { describe, expect, it } from 'vitest'
import { canAccess, hasAnyRole, isStaff } from './roles'

describe('permisos de interfaz', () => {
  it('solo el superadmin accede a usuarios y configuración', () => {
    expect(canAccess('usuarios', ['superadmin'])).toBe(true)
    expect(canAccess('usuarios', ['directivo'])).toBe(false)
    expect(canAccess('configuracion', ['docente'])).toBe(false)
  })
  it('un usuario con varios roles recibe la unión de permisos', () => {
    expect(canAccess('usuarios', ['docente', 'superadmin'])).toBe(true)
  })
  it('sin roles no hay acceso', () => {
    expect(canAccess('dashboard', [])).toBe(false)
    expect(hasAnyRole([], ['docente'])).toBe(false)
  })
  it('isStaff excluye docentes y familias', () => {
    expect(isStaff(['secretaria'])).toBe(true)
    expect(isStaff(['docente'])).toBe(false)
    expect(isStaff(['familia'])).toBe(false)
  })
})
