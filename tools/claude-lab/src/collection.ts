// A tiny model of a manga collection (series -> editions -> volumes), just
// enough for the tools of this lab. It does not touch the real application.

export interface Edition {
  name: string
  totalVolumes: number
  ownedVolumes: number[]
}

export interface Series {
  title: string
  author: string
  editions: Edition[]
}

export interface Collection {
  series: Series[]
}

export type VolumeStatus = 'owned' | 'missing' | 'out_of_range'

export interface EditionVolumeStatus {
  edition: string
  status: VolumeStatus
}

export interface EditionGaps {
  edition: string
  owned: number
  total: number
  missing: number[]
}

// Why a series or an edition could not be resolved. The caller decides what
// to do with it: a missing series is a normal answer ("you own nothing of it"),
// the other two need a corrected question.
export type LookupFailure =
  | { kind: 'unknown_series'; query: string }
  | { kind: 'ambiguous_series'; query: string; candidates: string[] }
  | { kind: 'unknown_edition'; series: string; edition: string; availableEditions: string[] }

export type OwnsVolumeResult =
  | { kind: 'ok'; series: string; volume: number; editions: EditionVolumeStatus[] }
  | LookupFailure

export type MissingVolumesResult = { kind: 'ok'; series: string; editions: EditionGaps[] } | LookupFailure

export function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index)
}

// Lowercase, no accents, no punctuation: "Édition classique" and
// "edition  classique!" are the same name.
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// An exact name wins. Otherwise a single partial match is accepted, and
// several partial matches are returned as candidates instead of guessing.
function pickByName<T>(items: T[], nameOf: (item: T) => string, query: string): { match: T } | { candidates: T[] } {
  const wanted = normalize(query)
  if (wanted === '') return { candidates: [] }
  const exact = items.filter((item) => normalize(nameOf(item)) === wanted)
  const [onlyExact] = exact
  if (exact.length === 1 && onlyExact) return { match: onlyExact }
  const partial = items.filter((item) => normalize(nameOf(item)).includes(wanted))
  const [onlyPartial] = partial
  if (partial.length === 1 && onlyPartial) return { match: onlyPartial }
  return { candidates: partial }
}

type Resolution = { kind: 'resolved'; series: Series; editions: Edition[] } | LookupFailure

function resolve(collection: Collection, seriesQuery: string, editionQuery?: string): Resolution {
  const seriesPick = pickByName(collection.series, (series) => series.title, seriesQuery)
  if ('candidates' in seriesPick) {
    return seriesPick.candidates.length === 0
      ? { kind: 'unknown_series', query: seriesQuery }
      : { kind: 'ambiguous_series', query: seriesQuery, candidates: seriesPick.candidates.map((series) => series.title) }
  }
  const series = seriesPick.match
  if (editionQuery === undefined) return { kind: 'resolved', series, editions: series.editions }

  const editionPick = pickByName(series.editions, (edition) => edition.name, editionQuery)
  if ('match' in editionPick) return { kind: 'resolved', series, editions: [editionPick.match] }
  return {
    kind: 'unknown_edition',
    series: series.title,
    edition: editionQuery,
    availableEditions: series.editions.map((edition) => edition.name),
  }
}

function statusOf(edition: Edition, volume: number): VolumeStatus {
  if (volume < 1 || volume > edition.totalVolumes) return 'out_of_range'
  return edition.ownedVolumes.includes(volume) ? 'owned' : 'missing'
}

export function ownsVolume(
  collection: Collection,
  query: { series: string; volume: number; edition?: string },
): OwnsVolumeResult {
  const resolved = resolve(collection, query.series, query.edition)
  if (resolved.kind !== 'resolved') return resolved
  return {
    kind: 'ok',
    series: resolved.series.title,
    volume: query.volume,
    editions: resolved.editions.map((edition) => ({
      edition: edition.name,
      status: statusOf(edition, query.volume),
    })),
  }
}

export function missingVolumes(collection: Collection, query: { series: string; edition?: string }): MissingVolumesResult {
  const resolved = resolve(collection, query.series, query.edition)
  if (resolved.kind !== 'resolved') return resolved
  return {
    kind: 'ok',
    series: resolved.series.title,
    editions: resolved.editions.map((edition) => ({
      edition: edition.name,
      owned: edition.ownedVolumes.length,
      total: edition.totalVolumes,
      missing: range(1, edition.totalVolumes).filter((volume) => !edition.ownedVolumes.includes(volume)),
    })),
  }
}
