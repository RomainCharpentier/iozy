import { post } from './client'
import type { AnalyzeImagesRequest, AnalyzeImagesResponse } from '../types/imageRecognition'

/**
 * Analyse des photos et rend des propositions à confirmer.
 *
 * Déclenché par un geste explicite de l'utilisateur (« Analyser les photos »),
 * jamais automatiquement au collage d'une URL : l'appel est coûteux, lent, et
 * envoie les images à un service externe. Trois raisons de ne pas le faire
 * dans son dos.
 */
export function analyzeImages(body: AnalyzeImagesRequest): Promise<AnalyzeImagesResponse> {
  return post<AnalyzeImagesResponse>('/image-recognition/analyze', body)
}
