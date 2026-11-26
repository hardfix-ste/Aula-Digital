export const TIME_ZONE = 'America/Argentina/Buenos_Aires'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** DD/MM/AAAA. Las fechas "YYYY-MM-DD" se formatean sin conversión de zona horaria. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const d = formatDate(date)
  const t = new Intl.DateTimeFormat('es-AR', {
    timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
  return `${d} ${t}`
}

/** Pesos argentinos (ARS) */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)
}

/** "Apellido, Nombre" */
export function fullName(p: { first_name: string; last_name: string }): string {
  return `${p.last_name}, ${p.first_name}`
}

/** Valida DNI argentino (6 a 9 dígitos, sin puntos) */
export function isValidDni(dni: string): boolean {
  return /^[0-9]{6,9}$/.test(dni)
}
