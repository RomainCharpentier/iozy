import { describe, expect, it } from 'vitest'
import type { ReleaseEntryDto } from '@/common/types/api'
import { escapeText, foldLine, releasesToIcs } from './releaseIcs'

const NOW = new Date('2026-11-07T10:20:30.000Z')

function entry(over: Partial<ReleaseEntryDto> = {}): ReleaseEntryDto {
  return {
    date: '2026-12-31',
    precision: 'DAY',
    entityId: 'e1',
    entityTitle: 'One Piece',
    entityTypeId: 't1',
    label: 'Tome 110',
    volumeNumber: 110,
    editionName: null,
    coverImageUrl: null,
    relation: 'MISSING',
    source: 'GOOGLE_BOOKS',
    ...over,
  }
}

describe('releasesToIcs', () => {
  it('writes one all-day event per release to buy or wanted', () => {
    const { ics, included, skipped } = releasesToIcs([entry(), entry({ entityId: 'e2', relation: 'WANTED', label: '', volumeNumber: null })], NOW)

    expect(included).toBe(2)
    expect(skipped).toBe(0)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('UID:e1-2026-12-31-110@iozycore\r\n')
    expect(ics).toContain('DTSTAMP:20261107T102030Z\r\n')
    // The end of an all-day event is the next day, here across the year.
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n')
    expect(ics).toContain('SUMMARY:One Piece · Tome 110\r\n')
    expect(ics).toContain('DESCRIPTION:À acheter\r\n')
    expect(ics).toContain('UID:e2-2026-12-31-work@iozycore\r\nDTSTAMP')
    expect(ics).toContain('SUMMARY:One Piece\r\nDESCRIPTION:Envie\r\n')
  })

  it('gives two editions of the same volume out the same day their own event', () => {
    const { ics } = releasesToIcs([entry({ editionName: 'Kana' }), entry({ editionName: 'Pika Edition' })], NOW)
    expect(ics).toContain('UID:e1-2026-12-31-110-Kana@iozycore\r\n')
    expect(ics).toContain('UID:e1-2026-12-31-110-Pika_Edition@iozycore\r\n')
  })

  it('ends every line with CRLF, never a bare LF', () => {
    const { ics } = releasesToIcs([entry({ entityTitle: 'Line\nbreak' })], NOW)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('leaves out owned releases, and counts the ones only known to the month', () => {
    const { ics, included, skipped } = releasesToIcs(
      [entry({ relation: 'OWNED' }), entry({ date: '2027-02', precision: 'MONTH' }), entry({ entityId: 'e3' })],
      NOW,
    )
    expect(included).toBe(1)
    expect(skipped).toBe(1)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('UID:e3-')
  })

  it('writes an empty calendar when nothing is left', () => {
    const { ics, included } = releasesToIcs([], NOW)
    expect(included).toBe(0)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('escapes the text values', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
    const { ics } = releasesToIcs([entry({ entityTitle: 'Dr. Stone, vol; 1', label: '' })], NOW)
    expect(ics).toContain('SUMMARY:Dr. Stone\\, vol\\; 1\r\n')
  })

  it('folds long lines at 75 octets without cutting a character', () => {
    const line = 'SUMMARY:' + 'é'.repeat(60)
    const folded = foldLine(line)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line)
    expect(foldLine('SHORT')).toBe('SHORT')
  })
})
