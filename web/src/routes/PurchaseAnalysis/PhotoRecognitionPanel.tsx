import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, Check, X, AlertCircle, HelpCircle } from 'lucide-react'
import { analyzeImages } from '../../api/imageRecognition'
import type {
  AnalyzeImagesResponse,
  RecognitionConfidence,
  RecognitionStatus,
  RecognizedItemDto,
} from '../../types/imageRecognition'

/**
 * « Analyser les photos » : propose ce qu'IozyCore croit voir, puis laisse
 * l'utilisateur trancher.
 *
 * Ce panneau ne décide de rien. Il affiche des propositions, permet de les
 * cocher, décocher, corriger le numéro de tome, et n'alimente le brouillon
 * d'analyse que sur un geste explicite. Confirmer signifie « voilà ce que
 * contient l'annonce » — jamais « j'ai acheté ces mangas » : aucune possession
 * n'est créée ici, ni à aucun moment de ce parcours.
 */

const LIBELLES_CONFIANCE: Record<RecognitionConfidence, string> = {
  HIGH: 'Confiance élevée',
  MEDIUM: 'Confiance moyenne',
  LOW: 'Piste incertaine',
}

const COULEURS_CONFIANCE: Record<RecognitionConfidence, string> = {
  HIGH: 'text-successText',
  MEDIUM: 'text-textDim',
  LOW: 'text-warningText',
}

/**
 * Chaque issue a sa phrase. Un bandeau unique confondrait « ces photos ne
 * montrent rien de lisible » avec « le service est cassé », alors que la
 * première ne se réessaie pas et la seconde si.
 */
const MESSAGES_STATUT: Record<RecognitionStatus, string> = {
  OK: '',
  PARTIAL: '',
  NOTHING_RECOGNIZED: "Rien de lisible sur ces photos. Ajoutez les tomes à la main, c'est juste en dessous.",
  NO_USABLE_IMAGE: "Aucune photo exploitable. Ajoutez les tomes à la main, c'est juste en dessous.",
  NO_ENGINE:
    "La reconnaissance de photos n'est pas configurée sur cette instance. Tout le reste de l'analyse fonctionne normalement.",
  UNAVAILABLE: "La reconnaissance n'a pas pu aboutir. Réessayez, ou ajoutez les tomes à la main.",
}

export interface ElementConfirme {
  seriesTitle: string
  editionName: string
  volumeNumber: number
}

export function PhotoRecognitionPanel({
  imageUrls,
  listingTitle,
  onConfirm,
}: {
  imageUrls: string[]
  listingTitle: string
  /** Reçoit les éléments cochés — le parent les verse dans le brouillon d'analyse. */
  onConfirm: (elements: ElementConfirme[]) => void
}) {
  const [resultat, setResultat] = useState<AnalyzeImagesResponse | null>(null)
  const [coches, setCoches] = useState<Set<number>>(new Set())
  const [editions, setEditions] = useState<Record<number, string>>({})
  const [tomes, setTomes] = useState<Record<number, string>>({})
  const [retires, setRetires] = useState<Set<number>>(new Set())

  const mutation = useMutation({
    mutationFn: () =>
      analyzeImages({
        imageUrls,
        listingTitle: listingTitle.trim() || undefined,
        // La V1 n'est validée que sur le manga : on le dit plutôt que de
        // laisser le moteur répondre n'importe quoi sur un autre univers.
        entityTypeCode: 'MANGA',
      }),
    onSuccess: (reponse) => {
      setResultat(reponse)
      setRetires(new Set())
      setEditions({})
      setTomes({})
      // Seul ce dont on est sûr est pré-coché. Le reste demande un regard,
      // ce qui est bien le sujet de cet écran.
      setCoches(new Set(reponse.items.map((item, i) => (item.preselected ? i : -1)).filter((i) => i >= 0)))
    },
  })

  if (imageUrls.length === 0) return null

  const items = resultat?.items ?? []
  const visibles = items.map((item, index) => ({ item, index })).filter(({ index }) => !retires.has(index))

  function basculer(index: number) {
    setCoches((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(index)) suivant.delete(index)
      else suivant.add(index)
      return suivant
    })
  }

  /**
   * Un élément n'est confirmable que s'il porte une série, un tome ET une
   * édition. L'édition n'est jamais choisie à sa place : si elle est ambiguë,
   * la liste est proposée mais rien n'est présélectionné.
   */
  function elementPret(item: RecognizedItemDto, index: number): ElementConfirme | null {
    const tomeSaisi = tomes[index]?.trim()
    const numero = tomeSaisi ? Number(tomeSaisi) : item.volumeNumber
    if (!numero || !Number.isInteger(numero) || numero < 1) return null

    const edition = editions[index] ?? item.editionHint
    if (!edition) return null

    return { seriesTitle: item.seriesTitle, editionName: edition, volumeNumber: numero }
  }

  /**
   * Ce qui manque à une ligne cochée pour être confirmable.
   *
   * Sans ce message, cocher une ligne incomplète ne fait rien bouger au
   * compteur et l'utilisateur ne sait pas pourquoi — il croit à un bug. Dire
   * ce qui manque vaut mieux que compléter à sa place.
   */
  function ceQuiManque(item: RecognizedItemDto, index: number): string | null {
    const tomeSaisi = tomes[index]?.trim()
    const numero = tomeSaisi ? Number(tomeSaisi) : item.volumeNumber
    const sansTome = !numero || !Number.isInteger(numero) || numero < 1
    const sansEdition = !(editions[index] ?? item.editionHint)

    if (sansTome && sansEdition) return 'Indiquez le tome et l’édition pour pouvoir le confirmer.'
    if (sansTome) return 'Indiquez le numéro de tome pour pouvoir le confirmer.'
    if (sansEdition) return 'Choisissez l’édition pour pouvoir le confirmer.'
    return null
  }

  const confirmables = visibles
    .filter(({ index }) => coches.has(index))
    .map(({ item, index }) => elementPret(item, index))
    .filter((element): element is ElementConfirme => element !== null)

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-textPrimary">Reconnaissance des photos</span>
          <span className="text-xs text-textDim">
            IozyCore propose, vous confirmez — rien n'est ajouté à votre collection.
          </span>
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accentText disabled:opacity-50"
        >
          <Sparkles size={14} />
          {mutation.isPending ? 'Analyse en cours…' : resultat ? 'Relancer' : 'Analyser les photos'}
        </button>
      </div>

      {mutation.isPending && (
        <p className="text-xs text-textDim" role="status">
          Lecture de {imageUrls.length} photo{imageUrls.length > 1 ? 's' : ''}…
        </p>
      )}

      {mutation.isError && (
        <p className="text-xs text-dangerText" role="alert">
          L'analyse des photos a échoué. Vous pouvez ajouter les tomes à la main juste en dessous.
        </p>
      )}

      {resultat && MESSAGES_STATUT[resultat.status] && (
        <p className="flex items-start gap-1.5 text-xs text-textDim" role="status">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {MESSAGES_STATUT[resultat.status]}
        </p>
      )}

      {resultat && visibles.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            {visibles.map(({ item, index }) => (
              <LigneElement
                key={`${item.seriesTitle}-${item.volumeNumber}-${index}`}
                item={item}
                coche={coches.has(index)}
                manque={coches.has(index) ? ceQuiManque(item, index) : null}
                editionChoisie={editions[index]}
                tomeSaisi={tomes[index]}
                onBasculer={() => basculer(index)}
                onEdition={(nom) => setEditions((prev) => ({ ...prev, [index]: nom }))}
                onTome={(valeur) => setTomes((prev) => ({ ...prev, [index]: valeur }))}
                onRetirer={() => {
                  setRetires((prev) => new Set(prev).add(index))
                  setCoches((prev) => {
                    const suivant = new Set(prev)
                    suivant.delete(index)
                    return suivant
                  })
                }}
              />
            ))}
          </div>

          {resultat.unidentifiedCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-textDim">
              <HelpCircle size={13} className="shrink-0" />
              {resultat.unidentifiedCount} élément{resultat.unidentifiedCount > 1 ? 's' : ''} visible
              {resultat.unidentifiedCount > 1 ? 's' : ''} mais non identifié
              {resultat.unidentifiedCount > 1 ? 's' : ''} — à ajouter à la main si besoin.
            </p>
          )}

          <button
            type="button"
            onClick={() => onConfirm(confirmables)}
            disabled={confirmables.length === 0}
            className="mt-1 min-h-11 rounded-lg bg-surface px-3 text-sm font-semibold text-textPrimary disabled:opacity-40"
          >
            Confirmer {confirmables.length} élément{confirmables.length > 1 ? 's' : ''}
          </button>
          <p className="text-xs text-textDim">
            Confirmer décrit ce que contient l'annonce. Aucun exemplaire n'est ajouté à votre collection.
          </p>
        </>
      )}
    </div>
  )
}

function LigneElement({
  item,
  coche,
  manque,
  editionChoisie,
  tomeSaisi,
  onBasculer,
  onEdition,
  onTome,
  onRetirer,
}: {
  item: RecognizedItemDto
  coche: boolean
  /** Ce qui empêche cette ligne cochée d'être confirmée, ou null si elle est prête. */
  manque: string | null
  editionChoisie: string | undefined
  tomeSaisi: string | undefined
  onBasculer: () => void
  onEdition: (nom: string) => void
  onTome: (valeur: string) => void
  onRetirer: () => void
}) {
  const numero = tomeSaisi ?? (item.volumeNumber !== null ? String(item.volumeNumber) : '')

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-2">
      <div className="flex items-start gap-2">
        {/* Visuel de 20px, zone tactile de 44px : le carre reste discret dans une
            liste dense, tout en restant attrapable au pouce. */}
        <button
          type="button"
          onClick={onBasculer}
          role="checkbox"
          aria-checked={coche}
          aria-label={`Retenir ${item.seriesTitle}`}
          className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border ${
              coche ? 'border-accent bg-accent text-accentText' : 'border-textDim/40 text-transparent'
            }`}
          >
            <Check size={12} />
          </span>
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-textPrimary">{item.seriesTitle}</span>

          {/* L'écart entre ce qui est lu et ce que dit le catalogue reste visible. */}
          {item.seriesTitleAsRead !== item.seriesTitle && (
            <span className="truncate text-xs text-textDim">Lu sur la photo : « {item.seriesTitleAsRead} »</span>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className={COULEURS_CONFIANCE[item.confidence]}>{LIBELLES_CONFIANCE[item.confidence]}</span>
            {item.catalogStatus === 'NOT_IN_CATALOG' && (
              <span className="text-warningText">Reconnu, mais pas encore dans votre catalogue</span>
            )}
            {item.catalogStatus === 'EDITION_TO_CONFIRM' && (
              <span className="text-warningText">Édition à confirmer</span>
            )}
            {item.sourceImages.length > 1 && (
              <span className="text-textDim">
                Vu sur {item.sourceImages.length} photos ({item.sourceImages.map((i) => i + 1).join(', ')})
              </span>
            )}
          </div>

          {item.evidence.length > 0 && (
            <span className="truncate text-xs text-textDim">Indice : {item.evidence.join(' · ')}</span>
          )}
        </div>

        <button
          type="button"
          onClick={onRetirer}
          aria-label={`Retirer ${item.seriesTitle} des propositions`}
          className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3 text-textDim hover:text-dangerText"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-7">
        <label className="flex items-center gap-1 text-xs text-textDim">
          Tome
          <input
            type="number"
            min={1}
            value={numero}
            onChange={(e) => onTome(e.target.value)}
            placeholder="?"
            aria-label={`Numéro de tome de ${item.seriesTitle}`}
            className="min-h-11 w-16 rounded bg-surface2 px-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </label>

        {/* Édition : proposée, jamais choisie d'office quand elle est ambiguë. */}
        {item.editionOptions.length > 0 ? (
          <select
            value={editionChoisie ?? ''}
            onChange={(e) => onEdition(e.target.value)}
            aria-label={`Édition de ${item.seriesTitle}`}
            className="min-h-11 rounded bg-surface2 px-2 text-sm text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            <option value="">Édition à choisir…</option>
            {item.editionOptions.map((option) => (
              <option key={option.editionId} value={option.editionName}>
                {option.editionName}
                {option.totalVolumes !== null ? ` · ${option.totalVolumes} tomes` : ''}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={editionChoisie ?? item.editionHint ?? ''}
            onChange={(e) => onEdition(e.target.value)}
            placeholder="Édition"
            aria-label={`Édition de ${item.seriesTitle}`}
            className="min-h-11 w-32 rounded bg-surface2 px-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        )}
      </div>

      {manque && (
        <p className="pl-7 text-xs text-warningText" role="status">
          {manque}
        </p>
      )}
    </div>
  )
}
