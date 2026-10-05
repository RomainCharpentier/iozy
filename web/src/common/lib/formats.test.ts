import { describe, expect, it } from 'vitest'
import { formaterDateCourte, formaterDecimal, formaterEuros } from './formats'

/** The spaces that `fr-FR` inserts (narrow no-break before €, no-break between thousands). */
const normaliser = (s: string) => s.replace(/[  ]/g, ' ')

describe('formaterEuros', () => {
  it('writes the decimal comma and two decimals, always', () => {
    expect(normaliser(formaterEuros(7.2))).toBe('7,20 €')
    expect(normaliser(formaterEuros(0))).toBe('0,00 €')
  })

  it('separates the thousands', () => {
    expect(normaliser(formaterEuros(1234.5))).toBe('1 234,50 €')
  })

  it('rounds to the cent', () => {
    expect(normaliser(formaterEuros(20.8000001))).toBe('20,80 €')
  })
})

describe('formaterDecimal', () => {
  it('one decimal by default, French comma', () => {
    expect(formaterDecimal(4.66)).toBe('4,7')
    expect(formaterDecimal(5)).toBe('5,0')
  })
})

describe('formaterDateCourte', () => {
  it('reads an ISO date as a local date, without a day shift', () => {
    expect(formaterDateCourte('2026-08-12')).toBe('12 août 2026')
    expect(formaterDateCourte('2026-01-01')).toBe('1 janv. 2026')
  })

  it('returns the string as it is if it does not look like a date', () => {
    expect(formaterDateCourte('bientôt')).toBe('bientôt')
  })
})
