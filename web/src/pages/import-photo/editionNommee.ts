/** An edition always has a name: an empty or blank one counts as "not chosen yet". */
export function editionNommee(nom: string | undefined): boolean {
  return nom !== undefined && nom.trim() !== ''
}
