import { post } from './client'
import type { ImportReport } from '@/common/types/api'

/**
 * Le retour de l'export (`/api/export/json`) : le fichier JSON téléchargé est
 * renvoyé tel quel, deux fois. D'abord pour savoir ce que l'import ferait
 * (rien n'est écrit), puis pour le faire. Le corps est le document parsé, pas
 * le fichier : c'est ce que le backend attend en `@RequestBody`.
 */
export function analyserImport(document: unknown): Promise<ImportReport> {
  return post<ImportReport>('/import/analyse', document)
}

export function appliquerImport(document: unknown): Promise<ImportReport> {
  return post<ImportReport>('/import/appliquer', document)
}
