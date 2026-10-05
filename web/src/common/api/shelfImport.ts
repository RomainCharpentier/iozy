import { post, postForm } from './client'
import type { RapportImportEtagereDto, ShelfAnalysisDto, TomeAImporter } from '@/common/types/shelfImport'

/**
 * Reads photos of the shelf. Writes nothing: this is the "analysis" half of
 * the import, the writing comes from `importerDepuisLEtagere`, on what the
 * user confirmed.
 *
 * The photos leave the machine (external vision engine) - the screen says so
 * before the action, and nothing is sent without an explicit choice of files.
 */
export function analyserLEtagere(photos: File[]): Promise<ShelfAnalysisDto> {
  const form = new FormData()
  photos.forEach((photo) => form.append('photos', photo))
  return postForm<ShelfAnalysisDto>('/shelf-import/analyze-photos', form)
}

/** Adds the confirmed volumes, in one transaction on the server side. */
export function importerDepuisLEtagere(items: TomeAImporter[]): Promise<RapportImportEtagereDto> {
  return post<RapportImportEtagereDto>('/shelf-import/apply', { items })
}
