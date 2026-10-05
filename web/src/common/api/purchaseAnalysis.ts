import { get, post, patch, del } from './client'
import { buildQuery } from './client'
import type {
  AnalyzeListingRequest,
  CollectionStatusDto,
  CreateMangaEditionRequest,
  EditionSuggestionDto,
  ListingPreviewDto,
  MangaEditionDto,
  MarketPriceObservationDto,
  NearCompleteSuggestionDto,
  PurchaseAnalysisDto,
  PurchaseAnalysisSummaryDto,
  RecordMarketObservationRequest,
  UpdateMangaEditionRequest,
} from '@/common/types/purchaseAnalysis'

export function analyzeListing(body: AnalyzeListingRequest): Promise<PurchaseAnalysisDto> {
  return post<PurchaseAnalysisDto>('/purchase-analysis/analyze', body)
}

export function listAnalysisHistory(): Promise<PurchaseAnalysisSummaryDto[]> {
  return get<PurchaseAnalysisSummaryDto[]>('/purchase-analysis/history')
}

export function getAnalysisById(id: string): Promise<PurchaseAnalysisDto> {
  return get<PurchaseAnalysisDto>(`/purchase-analysis/history/${id}`)
}

/** 404 if the edition is not known yet - triggers the inline entry form on the
 * client side (see EditionReferenceLookup), this is not a
 * real error.
 * <p>
 * `entityId` (see migration "Series -> Edition by ID"): to provide as soon as
 * the caller knows the Series for sure (e.g. Series detail page) - the
 * search then goes through the ID first on the backend side, immune to
 * a rename of the Series that happened since. Omitted (e.g. Evaluate a purchase on
 * a series not necessarily in the collection), the historical fallback by title
 * stays unchanged. */
export function findEdition(seriesTitle: string, editionName: string, entityId?: string): Promise<MangaEditionDto> {
  return get<MangaEditionDto>(`/purchase-analysis/editions${buildQuery({ entityId, seriesTitle, editionName })}`)
}

/** Phase 2 (AI assistance) - undefined (204) if no AI provider is
 * configured or could propose nothing, never an error. Purely a
 * suggestion to have reviewed: records nothing, see EditionReferenceLookup. */
export function suggestEditionReferenceData(seriesTitle: string, editionName: string): Promise<EditionSuggestionDto | undefined> {
  return get<EditionSuggestionDto | undefined>(`/purchase-analysis/editions/ai-suggestion${buildQuery({ seriesTitle, editionName })}`)
}

/** "Cost to complete a series" (Ma collection/detail page of a series) - same
 * engine as the Purchase analysis, applied to the volumes already owned rather
 * than to a listing. `volumes`: volume numbers really owned (active
 * Ownership), never just cataloged (Volume model != Ownership). `cataloguedVolumes`
 * (step 8): volume numbers having a cataloged Variant, whatever their
 * Ownership - optional, lets the answer tell "missing but already
 * cataloged" from "missing and purely virtual" (see cataloguedMissingVolumeNumbers). */
/** `entityId` (see findEdition): preferred as soon as the caller knows it. */
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

/** All known editions, all series together - a single request to
 * display the progress PER EDITION of several series at once (see Ma
 * collection, editionTotals). The reference data is small by nature: one row per
 * edition really filled in. */
export function listAllEditions(): Promise<MangaEditionDto[]> {
  return get<MangaEditionDto[]>('/purchase-analysis/editions/all')
}

/** "Purchase suggestions" (Mon profil) - sorted on the backend side by increasing number of missing volumes. */
export function getNearCompleteSuggestions(): Promise<NearCompleteSuggestionDto[]> {
  return get<NearCompleteSuggestionDto[]>('/purchase-analysis/near-complete-suggestions')
}

/** Deletes a reference edition - 409 if volumes are still
 * attached to it (never a silent unlinking, see PurchaseAnalysisService.deleteEdition). */
export function deleteEdition(id: string): Promise<void> {
  return del<void>(`/purchase-analysis/editions/${id}`)
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

/**
 * Removes an analysis from the history. No edit is offered
 * alongside: an analysis is the FROZEN RESULT of a calculation on a listing at a
 * given moment - correcting a number would produce a verdict that was never
 * calculated. We delete it, and run a new analysis if needed.
 *
 * Does not delete the prices recorded or the editions filled in during this
 * analysis: they are reference data that serve all the following
 * analyses. Idempotent.
 */
export function deleteAnalysis(id: string): Promise<void> {
  return del<void>(`/purchase-analysis/history/${id}`)
}

/** The recorded prices of an edition, from newest to oldest. */
export function listMarketObservations(mangaEditionId: string): Promise<MarketPriceObservationDto[]> {
  return get<MarketPriceObservationDto[]>(`/purchase-analysis/market-observations${buildQuery({ mangaEditionId })}`)
}

/**
 * Removes a price recorded by mistake. No edit is offered: a
 * record is a fact observed on a date, not a field to adjust - we
 * remove the wrong one and record the right one. The analyses already saved do not
 * move (each one freezes its numbers at the time of the calculation); it is the
 * following ones that will stop counting this record. Idempotent.
 */
export function deleteMarketObservation(id: string): Promise<void> {
  return del<void>(`/purchase-analysis/market-observations/${id}`)
}

/**
 * Reads a listing from its link to prefill the analysis draft.
 *
 * Always answers 200: a deleted listing, an unsupported platform
 * or a partial result are normal outcomes of the flow, not
 * errors - it is `status` that tells them apart, never an exception. The manual
 * form stays usable in every case.
 */
export function resolveListing(url: string): Promise<ListingPreviewDto> {
  return post<ListingPreviewDto>('/listing-metadata/resolve', { url })
}

/**
 * The editions that the catalog knows for this series.
 *
 * Used so that the edition is no longer guessed: rather than a free field where one
 * types "Standard" at random - a label that can match by accident
 * another edition and distort the market reference - we offer what really
 * exists.
 */
export function searchEditionsForSeries(seriesTitle: string): Promise<MangaEditionDto[]> {
  return get<MangaEditionDto[]>(`/purchase-analysis/editions/search${buildQuery({ seriesTitle })}`)
}
