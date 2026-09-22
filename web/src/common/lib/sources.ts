/**
 * Le nom d'une source de métadonnées, tel qu'elle s'appelle.
 *
 * Les suggestions du Catalogue affichaient le code du fournisseur tel que
 * l'API le renvoie - « ANILIST », « GOOGLE_BOOKS », « OPEN_LIBRARY » - en
 * capitales et avec des tirets bas, au milieu d'une ligne en français. Un
 * code inconnu (une source ajoutée demain) reste affiché tel quel plutôt que
 * d'être caché : dire d'où vient une fiche compte plus que la joliesse.
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
