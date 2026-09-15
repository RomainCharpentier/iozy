import { post, postForm } from './client'
import type { RapportImportEtagereDto, ShelfAnalysisDto, TomeAImporter } from '@/common/types/shelfImport'

/**
 * Lit des photos de l'étagère. N'écrit rien : c'est la moitié « analyse » de
 * l'import, l'écriture vient de `importerDepuisLEtagere`, sur ce que
 * l'utilisateur a confirmé.
 *
 * Les photos quittent la machine (moteur de vision externe) - l'écran le dit
 * avant le geste, et rien ne part sans un choix explicite de fichiers.
 */
export function analyserLEtagere(photos: File[]): Promise<ShelfAnalysisDto> {
  const form = new FormData()
  photos.forEach((photo) => form.append('photos', photo))
  return postForm<ShelfAnalysisDto>('/shelf-import/analyze-photos', form)
}

/** Ajoute les tomes confirmés, en une transaction côté serveur. */
export function importerDepuisLEtagere(items: TomeAImporter[]): Promise<RapportImportEtagereDto> {
  return post<RapportImportEtagereDto>('/shelf-import/apply', { items })
}
