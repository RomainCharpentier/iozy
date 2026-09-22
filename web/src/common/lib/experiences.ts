/**
 * Les expériences, dites en français.
 *
 * <h2>Le défaut</h2>
 * Une expérience porte un code (`READ`, `PLAYED`, `FINISHED`…) que le type de
 * collection déclare (voir EntityType.allowedExperienceTypes). L'éditeur de la
 * fiche affichait ce code tel quel : des pastilles « READ », « IN_PROGRESS »,
 * « ABANDONED » au milieu d'un écran entièrement en français - le vocabulaire
 * de la base de données, pas celui de la personne qui lit.
 *
 * <h2>Ce que ce module ne fait pas</h2>
 * Un code inconnu (un type créé à la main avec ses propres expériences) est
 * rendu tel quel plutôt que traduit au hasard : mieux vaut un mot brut qu'un
 * mot faux.
 */
const LIBELLES: Record<string, string> = {
  READ: 'Lu',
  IN_PROGRESS: 'En cours',
  ABANDONED: 'Abandonné',
  FINISHED: 'Terminé',
  PLAYED: 'Joué',
  WATCHED: 'Vu',
  LISTENED: 'Écouté',
}

/** « Lu », « Joué », « Terminé » - ou le code lui-même s'il n'est pas connu. */
export function libelleExperienceType(code: string): string {
  return LIBELLES[code.toUpperCase()] ?? code
}

/**
 * L'intitulé de la rangée « expériences » d'une fiche, dans le vocabulaire du
 * type : « Lectures » ne vaut que pour ce qui se lit, et la fiche d'un jeu
 * vidéo l'affichait quand même. Un type qui se joue a des parties ; un type
 * qu'on ne sait pas nommer a des expériences, mot neutre plutôt que mot faux.
 */
export function libelleSectionExperiences(codes: string[]): string {
  const majuscules = codes.map((c) => c.toUpperCase())
  if (majuscules.includes('READ')) return 'Lectures'
  if (majuscules.includes('WATCHED')) return 'Visionnages'
  if (majuscules.includes('LISTENED')) return 'Écoutes'
  if (majuscules.includes('PLAYED') || majuscules.includes('FINISHED')) return 'Parties'
  return 'Expériences'
}
