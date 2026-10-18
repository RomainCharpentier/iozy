/**
 * Experiences, said in French.
 *
 * <h2>The flaw</h2>
 * An experience carries a code (`READ`, `PLAYED`, `FINISHED`...) that the
 * collection type declares (see EntityType.allowedExperienceTypes). The editor
 * of the detail page displayed this code as it is: "READ", "IN_PROGRESS",
 * "ABANDONED" chips in the middle of an entirely French screen - the
 * vocabulary of the database, not the one of the person reading.
 *
 * <h2>What this module does not do</h2>
 * An unknown code (a type created by hand with its own experiences) is
 * rendered as it is rather than translated at random: a raw word is better
 * than a wrong word.
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

/** "Lu", "Joué", "Terminé" - or the code itself if it is not known. */
export function libelleExperienceType(code: string): string {
  return LIBELLES[code.toUpperCase()] ?? code
}

/**
 * The title of the "experiences" row of a detail page, in the vocabulary of
 * the type: "Lectures" only fits what is read, and the detail page of a video
 * game displayed it anyway. A type that is played has games; a type that we
 * cannot name has experiences, a neutral word rather than a wrong word.
 */
export function libelleSectionExperiences(codes: string[]): string {
  const majuscules = codes.map((c) => c.toUpperCase())
  if (majuscules.includes('READ')) return 'Lectures'
  if (majuscules.includes('WATCHED')) return 'Visionnages'
  if (majuscules.includes('LISTENED')) return 'Écoutes'
  if (majuscules.includes('PLAYED') || majuscules.includes('FINISHED')) return 'Parties'
  return 'Expériences'
}
