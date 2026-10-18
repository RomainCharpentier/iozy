/**
 * <b>What we read on a volume, and what we refuse to read there.</b>
 *
 * The attributes of a Variant are an untyped bag: it is therefore the reader
 * that decides what it accepts, and this is exactly where two screens have
 * already diverged - the assistant accepted a number written as TEXT
 * (`"12"`), the grid did not. A volume entered that way was counted on one
 * side and invisible on the other.
 *
 * <p>The rule is therefore worth as much for what it returns as for what it
 * rejects, and the rejection is the half that no type protects: `attributes`
 * being `Record<string, unknown>`, TypeScript lets anything through.
 */
import { describe, expect, it } from 'vitest'
import { editionDe, numeroDe, variantLabel } from './attributsTome'

describe('numeroDe', () => {
  it('accepts a real number', () => {
    expect(numeroDe({ attributes: { volumeNumber: 12 } })).toBe(12)
    expect(numeroDe({ attributes: { volumeNumber: 0 } })).toBe(0)
  })

  it('refuses a number written as text, even a perfectly numeric one', () => {
    // Tolerating "12" here would mean accepting data that the write screens
    // forbid themselves to produce.
    expect(numeroDe({ attributes: { volumeNumber: '12' } })).toBeNull()
  })

  it('returns null for everything that is not a number', () => {
    expect(numeroDe({ attributes: {} })).toBeNull()
    expect(numeroDe({ attributes: { volumeNumber: null } })).toBeNull()
    expect(numeroDe({ attributes: { volumeNumber: true } })).toBeNull()
  })
})

describe('editionDe', () => {
  it('trims at the ends - a typing space does not make another edition', () => {
    expect(editionDe({ attributes: { edition: '  Glénat ' } })).toBe('Glénat')
  })

  it('keeps the case: this is the name that is displayed and that the server returns', () => {
    expect(editionDe({ attributes: { edition: 'KANA' } })).toBe('KANA')
  })

  it('returns the empty string when no edition is given', () => {
    // '' is a VALUE here (the group of volumes without an edition), not an absence.
    expect(editionDe({ attributes: {} })).toBe('')
    expect(editionDe({ attributes: { edition: 42 } })).toBe('')
  })
})

describe('variantLabel', () => {
  const tome = (attributes: Record<string, unknown>, label: string) => ({
    id: 'v1',
    label,
    attributes,
    mangaEditionId: null,
  })

  it('names the volume by its number when it has one', () => {
    expect(variantLabel(tome({ volumeNumber: 12 }, 'Berserk tome douze'))).toBe('Tome 12')
  })

  it('falls back on the raw label without a usable number', () => {
    expect(variantLabel(tome({ volumeNumber: '12' }, 'Coffret collector'))).toBe('Coffret collector')
  })
})
