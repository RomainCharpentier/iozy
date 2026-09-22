import { describe, expect, it } from 'vitest'
import { formaterDateCourte, formaterDecimal, formaterEuros } from './formats'

/** Les espaces que `fr-FR` insère (fine insécable devant €, insécable entre milliers). */
const normaliser = (s: string) => s.replace(/[  ]/g, ' ')

describe('formaterEuros', () => {
  it('écrit la virgule décimale et deux décimales, toujours', () => {
    expect(normaliser(formaterEuros(7.2))).toBe('7,20 €')
    expect(normaliser(formaterEuros(0))).toBe('0,00 €')
  })

  it('sépare les milliers', () => {
    expect(normaliser(formaterEuros(1234.5))).toBe('1 234,50 €')
  })

  it('arrondit au centime', () => {
    expect(normaliser(formaterEuros(20.8000001))).toBe('20,80 €')
  })
})

describe('formaterDecimal', () => {
  it('une décimale par défaut, virgule française', () => {
    expect(formaterDecimal(4.66)).toBe('4,7')
    expect(formaterDecimal(5)).toBe('5,0')
  })
})

describe('formaterDateCourte', () => {
  it('lit une date ISO comme une date locale, sans décalage de jour', () => {
    expect(formaterDateCourte('2026-08-12')).toBe('12 août 2026')
    expect(formaterDateCourte('2026-01-01')).toBe('1 janv. 2026')
  })

  it('rend la chaîne telle quelle si elle ne ressemble pas à une date', () => {
    expect(formaterDateCourte('bientôt')).toBe('bientôt')
  })
})
