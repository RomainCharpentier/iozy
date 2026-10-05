import { post } from './client'
import type { ImportReport } from '@/common/types/api'

/**
 * The return of the export (`/api/export/json`): the downloaded JSON file is
 * sent back as it is, twice. First to know what the import would do
 * (nothing is written), then to do it. The body is the parsed document, not
 * the file: this is what the backend expects as `@RequestBody`.
 */
export function analyserImport(document: unknown): Promise<ImportReport> {
  return post<ImportReport>('/import/analyse', document)
}

export function appliquerImport(document: unknown): Promise<ImportReport> {
  return post<ImportReport>('/import/appliquer', document)
}
