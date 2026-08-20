import { get, post, patch } from './client'
import { buildQuery } from './client'
import type {
  AnalyzeListingRequest,
  CollectionStatusDto,
  CollectorPreferencesDto,
  CreateMangaEditionRequest,
  EditionSuggestionDto,
  MangaEditionDto,
  MarketPriceObservationDto,
  NearCompleteSuggestionDto,
  PurchaseAnalysisDto,
  PurchaseAnalysisSummaryDto,
  RecordMarketObservationRequest,
  UpdateMangaEditionRequest,
} from '../types/purchaseAnalysis'

export function analyzeListing(body: AnalyzeListingRequest): Promise<PurchaseAnalysisDto> {
  return post<PurchaseAnalysisDto>('/purchase-analysis/analyze', body)
}

export function listAnalysisHistory(): Promise<PurchaseAnalysisSummaryDto[]> {
  return get<PurchaseAnalysisSummaryDto[]>('/purchase-analysis/history')
}

export function getAnalysisById(id: string): Promise<PurchaseAnalysisDto> {
  return get<PurchaseAnalysisDto>(`/purchase-analysis/history/${id}`)
}

/** 404 si l'édition n'est pas encore connue - déclenche le formulaire de
 * saisie inline côté client (voir EditionReferenceLookup), ce n'est pas une
 * vraie erreur.
 * <p>
 * `entityId` (voir migration "Série -> Édition par ID") : à fournir dès que
 * l'appelant connaît la Série avec certitude (ex: fiche Série) - la
 * recherche passe alors par l'ID en priorité côté backend, immunisée contre
 * un renommage de la Série survenu depuis. Omis (ex: Évaluer un achat sur
 * une série pas nécessairement en collection), le repli par titre historique
 * reste inchangé. */
export function findEdition(seriesTitle: string, editionName: string, entityId?: string): Promise<MangaEditionDto> {
  return get<MangaEditionDto>(`/purchase-analysis/editions${buildQuery({ entityId, seriesTitle, editionName })}`)
}

/** `entityId` (voir findEdition) : fourni, ne renvoie QUE les éditions réellement
 * rattachées à cette Série (jamais de repli texte) plutôt que tout ce qui
 * correspond au titre. */
export function searchEditionsForSeries(seriesTitle: string, entityId?: string): Promise<MangaEditionDto[]> {
  return get<MangaEditionDto[]>(`/purchase-analysis/editions/search${buildQuery({ entityId, seriesTitle })}`)
}

/** Phase 2 (assistance IA) - undefined (204) si aucun fournisseur IA n'est
 * configuré ou n'a rien pu proposer, jamais une erreur. Purement une
 * suggestion à faire relire : n'enregistre rien, voir EditionReferenceLookup. */
export function suggestEditionReferenceData(seriesTitle: string, editionName: string): Promise<EditionSuggestionDto | undefined> {
  return get<EditionSuggestionDto | undefined>(`/purchase-analysis/editions/ai-suggestion${buildQuery({ seriesTitle, editionName })}`)
}

/** "Coût pour compléter une série" (Ma collection/fiche d'une série) - même
 * moteur que l'Analyse d'achat, appliqué aux tomes déjà possédés plutôt
 * qu'à une annonce. `volumes` : numéros de tome réellement possédés (Ownership
 * active), jamais juste catalogués (modèle Tome != Ownership). `cataloguedVolumes`
 * (étape 8) : numéros de tome ayant un Variant catalogué, quelle que soit leur
 * Ownership - optionnel, permet à la réponse de distinguer "manquant mais déjà
 * catalogué" de "manquant et purement virtuel" (voir cataloguedMissingVolumeNumbers). */
/** `entityId` (voir findEdition) : préféré dès qu'il est connu de l'appelant. */
export function getCompleteness(
  seriesTitle: string,
  editionName: string,
  volumes: number[],
  cataloguedVolumes?: number[],
  entityId?: string,
): Promise<CollectionStatusDto> {
  return get<CollectionStatusDto>(
    `/purchase-analysis/completeness${buildQuery({
      entityId,
      seriesTitle,
      editionName,
      volumes: volumes.join(','),
      cataloguedVolumes: cataloguedVolumes && cataloguedVolumes.length > 0 ? cataloguedVolumes.join(',') : undefined,
    })}`,
  )
}

/** Toutes les éditions connues, toutes séries confondues - une seule requête pour
 * afficher la progression PAR ÉDITION de plusieurs séries d'un coup (voir Ma
 * collection, editionTotals). Le référentiel est petit par nature : une ligne par
 * édition réellement renseignée. */
export function listAllEditions(): Promise<MangaEditionDto[]> {
  return get<MangaEditionDto[]>('/purchase-analysis/editions/all')
}

/** "Suggestions d'achats" (Mon profil) - triées côté backend par nombre de tomes manquants croissant. */
export function getNearCompleteSuggestions(): Promise<NearCompleteSuggestionDto[]> {
  return get<NearCompleteSuggestionDto[]>('/purchase-analysis/near-complete-suggestions')
}

export function createEdition(body: CreateMangaEditionRequest): Promise<MangaEditionDto> {
  return post<MangaEditionDto>('/purchase-analysis/editions', body)
}

export function updateEdition(id: string, body: UpdateMangaEditionRequest): Promise<MangaEditionDto> {
  return patch<MangaEditionDto>(`/purchase-analysis/editions/${id}`, body)
}

export function recordMarketObservation(body: RecordMarketObservationRequest): Promise<MarketPriceObservationDto> {
  return post<MarketPriceObservationDto>('/purchase-analysis/market-observations', body)
}

export function getPreferences(): Promise<CollectorPreferencesDto> {
  return get<CollectorPreferencesDto>('/purchase-analysis/preferences')
}

export function updatePreferences(body: CollectorPreferencesDto): Promise<CollectorPreferencesDto> {
  return patch<CollectorPreferencesDto>('/purchase-analysis/preferences', body)
}
