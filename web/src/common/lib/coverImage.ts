/**
 * Attribute key under which a real cover (Jikan / Google Books via
 * ISBN scan / Open Library) is persisted in `Entity.attributes` - like
 * `mangaka`/`publisher`, it is just one more generic attribute from the
 * backend point of view (see QuickAddService), not a dedicated field.
 * Centralized here so that QuickAddPage (write) and the display pages
 * (read) stay in sync on the same name. Mirror of the equivalent constant on
 * the iOS side (QuickAddView.selectCandidate).
 */
export const COVER_IMAGE_ATTRIBUTE_KEY = 'coverImageUrl'

/** Extracts the cover URL from an `Entity.attributes` if present and valid. */
export function coverImageUrlFrom(attributes: Record<string, unknown> | undefined): string | null {
  const value = attributes?.[COVER_IMAGE_ATTRIBUTE_KEY]
  return typeof value === 'string' && value.length > 0 ? value : null
}
