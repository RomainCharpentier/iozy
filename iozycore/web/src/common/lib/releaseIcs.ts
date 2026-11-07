import type { ReleaseEntryDto } from '@/common/types/api'
import { LIBELLES_RELATION } from './releaseDate'

export interface ReleaseIcs {
  /** The calendar file (RFC 5545), lines ended by CRLF. */
  ics: string
  /** Releases written as events. */
  included: number
  /** Releases to buy or wanted, but only known to the month: a calendar needs a day. */
  skipped: number
}

/** Only what one does not have yet: what one owns needs no reminder. */
const RELATIONS_TO_EXPORT = new Set(['MISSING', 'WANTED'])

/**
 * Builds a calendar file of the releases to buy and the wanted ones, one
 * all-day event per release known to the day. A release only known to the
 * month is left out (no date is made up) and counted in `skipped`.
 */
export function releasesToIcs(entries: ReleaseEntryDto[], now: Date): ReleaseIcs {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const candidates = entries.filter((e) => RELATIONS_TO_EXPORT.has(e.relation))
  const byDay = candidates.filter((e) => e.precision === 'DAY' && /^\d{4}-\d{2}-\d{2}$/.test(e.date))

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Iozy//IozyCore releases//FR', 'CALSCALE:GREGORIAN']
  for (const entry of byDay) {
    const summary = entry.label ? `${entry.entityTitle} · ${entry.label}` : entry.entityTitle
    const description = LIBELLES_RELATION[entry.relation] ?? entry.relation
    lines.push(
      'BEGIN:VEVENT',
      `UID:${entry.entityId}-${entry.date}-${entry.volumeNumber ?? 'work'}@iozycore`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(entry.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(entry.date))}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')

  return {
    ics: lines.map(foldLine).join('\r\n') + '\r\n',
    included: byDay.length,
    skipped: candidates.length - byDay.length,
  }
}

/** Escapes a TEXT value: backslash, semicolon, comma and line breaks. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Cuts a line over 75 octets into lines that start with a space (RFC 5545, 3.1). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const charSize = encoder.encode(char).length
    // The first line holds 75 octets; the next ones 74, after their leading space.
    const limit = parts.length === 0 ? 75 : 74
    if (size + charSize > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += charSize
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, '')
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}
