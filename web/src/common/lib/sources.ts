/**
 * The name of a metadata source, as it is called.
 *
 * The Catalogue suggestions displayed the provider code as the API returns
 * it - "ANILIST", "GOOGLE_BOOKS", "OPEN_LIBRARY" - in capitals and with
 * underscores, in the middle of a French line. An unknown code (a source
 * added tomorrow) stays displayed as it is rather than being hidden: saying
 * where a detail page comes from matters more than prettiness.
 */
const NOMS: Record<string, string> = {
  ANILIST: 'AniList',
  JIKAN: 'Jikan',
  MYANIMELIST: 'MyAnimeList',
  GOOGLE_BOOKS: 'Google Books',
  OPEN_LIBRARY: 'Open Library',
  BNF: 'BnF',
  BGG: 'BoardGameGeek',
  IGDB: 'IGDB',
}

export function nomDeSource(code: string): string {
  return NOMS[code.toUpperCase()] ?? code
}
