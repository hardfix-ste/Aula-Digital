import { describe, expect, it } from 'vitest'
import { formatDate, formatCurrency, fullName, isValidDni } from './format'

describe('formatDate', () => {
  it('formatea fechas ISO sin desplazar el día', () => {
    expect(formatDate('2026-03-01')).toBe('01/03/2026')
  })
  it('usa la zona horaria de Buenos Aires para instantes', () => {
    // 01:30 UTC del 2/3 es 22:30 del 1/3 en Argentina (UTC-3)
    expect(formatDate('2026-03-02T01:30:00Z')).toBe('01/03/2026')
  })
  it('devuelve guion para valores vacíos o inválidos', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('no-es-fecha')).toBe('—')
  })
})

describe('formatCurrency', () => {
  it('usa formato argentino', () => {
    const s = formatCurrency(1234.5).replace(/\s/g, ' ')
    expect(s).toContain('1.234,50')
    expect(s).toContain('$')
  })
})

describe('utilidades', () => {
  it('fullName', () => expect(fullName({ first_name: 'Ana', last_name: 'Pérez' })).toBe('Pérez, Ana'))
  it('isValidDni', () => {
    expect(isValidDni('30123456')).toBe(true)
    expect(isValidDni('30.123.456')).toBe(false)
    expect(isValidDni('123')).toBe(false)
  })
})
