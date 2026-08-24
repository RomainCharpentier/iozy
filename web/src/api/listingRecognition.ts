import { post, postForm } from './client'
import type { AnalyzeListingRequest, AnalyzeListingResponse } from '../types/listingRecognition'

/**
 * Détecte les éléments d'une annonce.
 *
 * Le titre et la description sont toujours lus, localement et sans coût.
 * `imageUrls` est le SEUL déclencheur d'un appel de moteur de vision : ne pas
 * le fournir garantit qu'aucune image ne part et qu'aucun euro n'est dépensé.
 */
export function analyzeListing(body: AnalyzeListingRequest): Promise<AnalyzeListingResponse> {
  return post<AnalyzeListingResponse>('/recognition/analyze', body)
}

/** Huit au maximum : au-delà, chaque photo est un appel de moteur de plus. */
export const MAX_PHOTOS_ENVOYEES = 8

/** 3 Mo par photo, aligné sur la borne du serveur. */
export const MAX_OCTETS_PAR_PHOTO = 3 * 1024 * 1024

/**
 * Analyse des photos que l'utilisateur fournit lui-même.
 *
 * L'autre chemin — `analyzeListing` avec `imageUrls` — suppose que les photos
 * soient joignables depuis le serveur. Trois situations courantes ne le
 * permettent pas :
 * - une plateforme qui refuse la lecture automatique (Leboncoin) ;
 * - une annonce dont le texte ne nomme aucune série (« mangas en tout genre »),
 *   où les photos sont la seule source ;
 * - une étagère photographiée chez soi, qui n'est l'annonce de personne.
 *
 * Dans les trois cas les images sont sous les yeux de l'utilisateur ; il lui
 * manquait le moyen de les donner. Comme pour `imageUrls`, **envoyer est le
 * consentement** : rien ne part sans ce geste.
 */
export function analyzeUploadedPhotos(
  photos: File[],
  contexte: { title?: string; description?: string; entityTypeCode?: string },
): Promise<AnalyzeListingResponse> {
  const form = new FormData()
  photos.forEach((photo) => form.append('photos', photo))
  if (contexte.title?.trim()) form.append('title', contexte.title.trim())
  if (contexte.description?.trim()) form.append('description', contexte.description.trim())
  if (contexte.entityTypeCode) form.append('entityTypeCode', contexte.entityTypeCode)
  return postForm<AnalyzeListingResponse>('/recognition/analyze-photos', form)
}
