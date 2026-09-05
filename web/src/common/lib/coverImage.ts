/**
 * Clé d'attribut sous laquelle une jaquette réelle (Jikan / Google Books via
 * scan ISBN / Open Library) est persistée dans `Entity.attributes` - au même
 * titre que `mangaka`/`publisher`, ce n'est qu'un attribut générique de plus
 * du point de vue du backend (voir QuickAddService), pas un champ dédié.
 * Centralisé ici pour que QuickAddPage (écriture) et les pages d'affichage
 * (lecture) restent synchronisées sur le même nom. Miroir de la constante
 * équivalente côté iOS (QuickAddView.selectCandidate).
 */
export const COVER_IMAGE_ATTRIBUTE_KEY = 'coverImageUrl'

/** Extrait l'URL de jaquette d'un `Entity.attributes` si présente et valide. */
export function coverImageUrlFrom(attributes: Record<string, unknown> | undefined): string | null {
  const value = attributes?.[COVER_IMAGE_ATTRIBUTE_KEY]
  return typeof value === 'string' && value.length > 0 ? value : null
}
