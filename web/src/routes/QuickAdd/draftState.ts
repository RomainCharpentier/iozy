import type { MetadataCandidateDto } from '../../types/api'

/**
 * Passé via `navigate(path, { state })` de SearchPage vers AddDraftPage -
 * jamais persisté (URL/localStorage), cohérent avec la nature éphémère de
 * "je viens de choisir un résultat" (voir la maquette V1.2, écran séparé
 * "Sélection des tomes à l'ajout"). `candidate: null` = entrée manuelle
 * (type sans fournisseur de métadonnées, voir EntityTypeDto.hasMetadataProvider) :
 * AddDraftPage saute alors toute la résolution/recherche de tomes, qui n'a
 * de sens que pour un candidat réel.
 */
export interface DraftLocationState {
  entityTypeId: string
  candidate: MetadataCandidateDto | null
  manualTitle?: string
}
