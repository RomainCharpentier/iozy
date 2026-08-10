import { get, post, patch } from './client'
import { buildQuery } from './client'
import type {
  AnalyzeListingRequest,
  CollectorPreferencesDto,
  CreateMangaEditionRequest,
  MangaEditionDto,
  MarketPriceObservationDto,
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
 * vraie erreur. */
export function findEdition(seriesTitle: string, editionName: string): Promise<MangaEditionDto> {
  return get<MangaEditionDto>(`/purchase-analysis/editions${buildQuery({ seriesTitle, editionName })}`)
}

export function searchEditionsForSeries(seriesTitle: string): Promise<MangaEditionDto[]> {
  return get<MangaEditionDto[]>(`/purchase-analysis/editions/search${buildQuery({ seriesTitle })}`)
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
