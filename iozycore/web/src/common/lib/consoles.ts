/**
 * The consoles of a video game: what the source lists on the work, and the short
 * name a shelf shows. The console of a COPY lives on its ownership: only its
 * owner knows it, the source only says where the game exists.
 */

/** The consoles a source knows for this work, in its order. Joined with ", " like the designers. */
export function consolesDeLOeuvre(attributes: Record<string, unknown>): string[] {
  const valeur = attributes.platforms
  if (typeof valeur !== 'string') return []
  return valeur
    .split(', ')
    .map((nom) => nom.trim())
    .filter((nom) => nom !== '')
}

/** IGDB says "PC (Microsoft Windows)"; on a shelf, and to a collector, it is "PC". */
export function nomDeConsole(console: string): string {
  return console.replace(/\s*\(Microsoft Windows\)$/, '')
}
