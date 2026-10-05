import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, Check, X, AlertCircle, HelpCircle, ImagePlus } from 'lucide-react'
import { analyzeListing, analyzeUploadedPhotos } from '@/common/api/listingRecognition'
import type {
  AnalyzeListingResponse,
  EditionOptionDto,
  RecognitionConfidence,
  RecognizedItemDto,
} from '@/common/types/listingRecognition'
import {
  COULEURS_CONFIANCE,
  LIBELLES_CONFIANCE,
  MESSAGES_VISION,
  RANG_CONFIANCE,
  cleSerie,
  identite,
} from '@/common/lib/reconnaissance'
import { preparerLesPhotos } from '@/common/lib/photosAAnalyser'
import { EDITION_INCONNUE } from './EditionPicker'
import { TexteCoupe } from '@/common/components/TexteCoupe'

/**
 * "Éléments détectés": the proposals to check before adding them to
 * the content of the batch.
 *
 * <h2>Grouped by series, because the edition is</h2>
 * The first version displayed one card per volume. For a batch of fourteen
 * volumes of the same series, this gave **1878 px high — 2.6 screens — and
 * fourteen identical edition fields** to fill in one by one.
 *
 * Yet the edition is not a property of the volume: it is a property of the
 * series. Asking for it fourteen times for the same work was not only
 * cumbersome, it was wrong. The proposals are therefore grouped by series,
 * the volumes become tickable chips, and the edition is chosen **once
 * per group**.
 *
 * <h2>Two principles unchanged</h2>
 * The text is analysed for free as soon as it exists; the photos only leave
 * on a click. And a manual correction is never overwritten: the
 * corrections are remembered by candidate identity, not by position.
 */

export interface ElementConfirme {
  seriesTitle: string
  editionName: string
  volumeNumber: number
}

interface Correction {
  editionName?: string
  retire?: boolean
  decoche?: boolean
  coche?: boolean
}

interface Ligne {
  item: RecognizedItemDto
  cle: string
}

/** A recognised series, with the volumes assigned to it. */
interface Groupe {
  cle: string
  seriesTitle: string
  catalogStatus: RecognizedItemDto['catalogStatus']
  editionOptions: EditionOptionDto[]
  sourceLabels: string[]
  /** The lowest of the group: it is the one that should prompt a check. */
  confiance: RecognitionConfidence
  lignes: Ligne[]
}

export function ListingDetectionPanel({
  title,
  description,
  imageUrls,
  dejaDansLeLot,
  onConfirm,
  onPrefillSeries,
  tomesDansLeLot,
}: {
  title: string
  description: string
  imageUrls: string[]
  /**
   * Takes back control from manual entry when the listing names a series without
   * saying which volumes. Without it we would send the user to retype "Naruto",
   * a word that the title already contained and that IozyCore read.
   */
  onPrefillSeries: (seriesTitle: string) => void
  /**
   * How many volumes the batch already contains. Only serves to compare the
   * entry with the announced number: an incomplete batch entered gives a flattering
   * price per volume, and so a purchase verdict that is too favourable.
   */
  tomesDansLeLot: number
  /**
   * Is this volume already in the content of the batch? A proposal already added
   * is displayed ticked and inert, rather than looking pending.
   */
  dejaDansLeLot: (seriesTitle: string, editionName: string, volumeNumber: number) => boolean
  /** Receives the confirmed items — the parent adds them to the content of the batch. */
  onConfirm: (elements: ElementConfirme[]) => void
}) {
  const [resultat, setResultat] = useState<AnalyzeListingResponse | null>(null)
  /** Corrections indexed by candidate identity — never by position. */
  const [corrections, setCorrections] = useState<Record<string, Correction>>({})

  const mutation = useMutation({
    mutationFn: (avecPhotos: boolean) =>
      analyzeListing({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        // NOT sending the photos is what guarantees that no engine
        // runs. It is the consent, not a separate flag.
        imageUrls: avecPhotos && imageUrls.length > 0 ? imageUrls : undefined,
        entityTypeCode: 'MANGA',
      }),
    onSuccess: (reponse) => setResultat(reponse),
  })

  /**
   * The photos that the user provides themselves.
   *
   * Path deliberately separate from `mutation`: that one starts from URLs that the
   * server will fetch, this one from files already in the hands of the
   * browser. Mixing them up would force writing "if one, then not
   * the other" — a rule that is always eventually read the wrong way.
   */
  const [refusees, setRefusees] = useState<string | null>(null)
  const champFichiers = useRef<HTMLInputElement | null>(null)

  const envoiPhotos = useMutation({
    mutationFn: (fichiers: File[]) =>
      analyzeUploadedPhotos(fichiers, {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        entityTypeCode: 'MANGA',
      }),
    onSuccess: (reponse) => setResultat(reponse),
  })

  const choisirPhotos = (liste: FileList | null) => {
    setRefusees(null)
    if (!liste || liste.length === 0) return
    // Copied BEFORE emptying the field: the FileList is live, emptying it
    // would also empty what we hold.
    const fichiers = Array.from(liste)

    // The field is emptied so that choosing the SAME file again does
    // relaunch an analysis: without this, the `change` event does not fire.
    if (champFichiers.current) champFichiers.current.value = ''

    // Reduction and sorting shared with the shelf import (photosAAnalyser):
    // a phone photo that is too heavy is reduced rather than discarded, and
    // what does not go is said at the time of the choice, naming the reason.
    void preparerLesPhotos(fichiers).then(({ retenues, message }) => {
      setRefusees(message)
      if (retenues.length > 0) envoiPhotos.mutate(retenues)
    })
  }

  const enCours = mutation.isPending || envoiPhotos.isPending

  const { mutate } = mutation
  const analyserTexte = useCallback(() => mutate(false), [mutate])

  // Automatic analysis of the text: local, deterministic, free. Debounced so as
  // not to relaunch at each keystroke when the user corrects the title.
  const texte = `${title} ${description}`
  const dernierTexte = useRef<string>('')
  useEffect(() => {
    if (!title.trim() && !description.trim()) return
    if (dernierTexte.current === texte) return
    const minuteur = setTimeout(() => {
      dernierTexte.current = texte
      analyserTexte()
    }, 600)
    return () => clearTimeout(minuteur)
  }, [texte, title, description, analyserTexte])

  /**
   * Nothing to show yet — but sending photos must stay reachable.
   *
   * The full panel only opens once it has something to propose:
   * it had already been judged too cluttered, and an empty header at the top of a
   * blank form teaches nothing. Hiding it entirely did close the
   * door in the only case where it is really useful: a listing with no usable
   * text, or a platform whose photos cannot be retrieved.
   * Hence this one-line version — the action, without the decor.
   */
  if (!resultat && !enCours) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => champFichiers.current?.click()}
          className="btn-secondaire self-start"
        >
          <ImagePlus size={14} />
          Envoyer mes photos
        </button>
        <span className="text-xs text-textDim">
          IozyCore y lit les séries et les tomes, puis vous confirmez.
        </span>
        {refusees && (
          <span className="text-xs text-textDim" role="status">
            {refusees}
          </span>
        )}
        {envoiPhotos.isError && (
          <span className="text-xs text-dangerText" role="alert">
            La détection a échoué. Vous pouvez ajouter les tomes à la main juste en dessous.
          </span>
        )}
        <input
          ref={champFichiers}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => choisirPhotos(e.target.files)}
          className="hidden"
          aria-label="Choisir des photos du lot à analyser"
        />
      </div>
    )
  }

  const lignes: Ligne[] = (resultat?.items ?? [])
    .map((item) => ({ item, cle: identite(item) }))
    .filter(({ cle }) => !corrections[cle]?.retire)

  /** The edition retained for this row: correction, otherwise reading. */
  function editionDe(ligne: Ligne): string | null {
    return corrections[ligne.cle]?.editionName ?? ligne.item.editionHint
  }

  function estCoche(ligne: Ligne): boolean {
    const correction = corrections[ligne.cle]
    if (correction?.decoche) return false
    if (correction?.coche) return true
    return ligne.item.preselected
  }

  function estDansLeLot(ligne: Ligne): boolean {
    const edition = editionDe(ligne)
    const numero = ligne.item.volumeNumber
    return edition !== null && numero !== null && dejaDansLeLot(ligne.item.seriesTitle, edition, numero)
  }

  /**
   * The proposals, gathered by series. The edition **read** is part of the key:
   * if the photos tell "Perfect" and "Standard" of the same series apart, these
   * are two groups — merging them would choose in place of the user.
   */
  const groupes: Groupe[] = []
  for (const ligne of lignes) {
    const cle = `${cleSerie(ligne.item)}|${(ligne.item.editionHint ?? '').toLowerCase()}`
    const existant = groupes.find((g) => g.cle === cle)
    if (existant) {
      existant.lignes.push(ligne)
      if (RANG_CONFIANCE[ligne.item.confidence] < RANG_CONFIANCE[existant.confiance]) {
        existant.confiance = ligne.item.confidence
      }
      continue
    }
    groupes.push({
      cle,
      seriesTitle: ligne.item.seriesTitle,
      catalogStatus: ligne.item.catalogStatus,
      editionOptions: ligne.item.editionOptions,
      sourceLabels: ligne.item.sourceLabels,
      confiance: ligne.item.confidence,
      lignes: [ligne],
    })
  }

  function corriger(cle: string, patch: Correction) {
    setCorrections((prev) => ({ ...prev, [cle]: { ...prev[cle], ...patch } }))
  }

  /** A chosen edition applies to the whole series: it is its property, not that of a volume. */
  function choisirEdition(groupe: Groupe, editionName: string) {
    setCorrections((prev) => {
      const suivant = { ...prev }
      for (const ligne of groupe.lignes) {
        suivant[ligne.cle] = { ...suivant[ligne.cle], editionName }
      }
      return suivant
    })
  }

  function basculerGroupe(groupe: Groupe, cocher: boolean) {
    setCorrections((prev) => {
      const suivant = { ...prev }
      for (const ligne of groupe.lignes) {
        if (estDansLeLot(ligne)) continue
        suivant[ligne.cle] = { ...suivant[ligne.cle], coche: cocher, decoche: !cocher }
      }
      return suivant
    })
  }

  function editionDeGroupe(groupe: Groupe): string | null {
    return editionDe(groupe.lignes[0])
  }

  function confirmablesDe(groupe: Groupe): ElementConfirme[] {
    const edition = editionDeGroupe(groupe)
    if (!edition) return []
    return groupe.lignes
      .filter((ligne) => estCoche(ligne) && !estDansLeLot(ligne) && ligne.item.volumeNumber !== null)
      .map((ligne) => ({
        seriesTitle: ligne.item.seriesTitle,
        editionName: edition,
        volumeNumber: ligne.item.volumeNumber as number,
      }))
  }

  const confirmables = groupes.flatMap(confirmablesDe)
  const aVerifier = groupes.reduce(
    (total, groupe) => total + groupe.lignes.filter((ligne) => !estDansLeLot(ligne)).length,
    0,
  )

  const analysePhotosFaite = resultat?.visionStatus != null
  /**
   * Did the photos bring something, by one means or another?
   *
   * A barcode read on a photo is a proposal coming from the photo, even
   * when the vision engine saw nothing — and it is a common case, an image
   * of the back of a manga showing only a code. Without this distinction, the screen
   * displayed "Les photos n'ont rien ajouté de lisible" right above a
   * volume identified by these same photos, with an exact identifier.
   */
  const photosOntApporte = (resultat?.items ?? []).some((item) =>
    item.sources.some((source) => source === 'EAN' || source === 'VISION'),
  )
  const messageVision =
    resultat?.visionStatus && !(resultat.visionStatus === 'NOTHING_RECOGNIZED' && photosOntApporte)
      ? MESSAGES_VISION[resultat.visionStatus]
      : ''

  // The server only returns this number while the question stays open: as soon
  // as a volume is identified, it disappears by itself. Nothing to arbitrate here.
  const nombreAnnonce = resultat?.announcedVolumeCount ?? null
  const serieAnnoncee = resultat?.announcedSeriesTitle ?? null

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-textPrimary">Éléments détectés</h3>
          <span className="text-xs text-textDim">
            {groupes.length === 0
              ? 'IozyCore propose, vous confirmez.'
              : aVerifier > 0
                ? `${aVerifier} tome${aVerifier > 1 ? 's' : ''} à vérifier avant de l'ajouter au lot`
                : 'Tout ce qui a été détecté est déjà dans le lot.'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {imageUrls.length > 0 && (
            <button
              type="button"
              onClick={() => mutation.mutate(true)}
              disabled={enCours}
              className="btn-primaire"
            >
              <Sparkles size={14} />
              {mutation.isPending ? 'Analyse…' : analysePhotosFaite ? 'Relancer les photos' : 'Analyser les photos'}
            </button>
          )}

          {/* Always offered, EVEN without a retrieved photo - it is precisely this
              case that was blind: a platform that refuses automatic
              reading, or a listing whose text names no series.
              Discreet when photos were retrieved, main otherwise. */}
          <button
            type="button"
            onClick={() => champFichiers.current?.click()}
            disabled={enCours}
            className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold disabled:opacity-50 ${
              imageUrls.length > 0
                ? 'bg-surface text-textPrimary'
                : 'bg-accent text-accentInk'
            }`}
          >
            <ImagePlus size={14} />
            {envoiPhotos.isPending ? 'Analyse…' : 'Envoyer mes photos'}
          </button>
          <input
            ref={champFichiers}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => choisirPhotos(e.target.files)}
            className="hidden"
            aria-label="Choisir des photos du lot à analyser"
          />
        </div>
      </div>

      {enCours && (
        <p className="text-xs text-textDim" role="status">
          Lecture en cours…
        </p>
      )}

      {refusees && (
        <p className="text-xs text-textDim" role="status">
          {refusees}
        </p>
      )}

      {(mutation.isError || envoiPhotos.isError) && (
        <p className="text-xs text-dangerText" role="alert">
          La détection a échoué. Vous pouvez ajouter les tomes à la main juste en dessous.
        </p>
      )}

      {messageVision && (
        <p className="flex items-start gap-1.5 text-xs text-textDim" role="status">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {messageVision}
        </p>
      )}

      {/* "9 tomes de Naruto": the listing says how many, not which.
          Nothing is proposed - the seller may have volumes 14 to 22, and
          ticking 1 to 9 by default would give a wrong verdict with the confidence of a
          calculation. We say what we know, and ask the only open question.

          Removed as soon as the batch contains something: the question found
          an answer, and the pre-fill button would then overwrite the series
          that the user has just entered. The count, for its part, stays monitored
          just below. */}
      {nombreAnnonce !== null && tomesDansLeLot === 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-surface px-2.5 py-2">
          <p className="flex items-start gap-1.5 text-xs text-textPrimary">
            <HelpCircle size={13} className="mt-0.5 shrink-0" />
            <span>
              L'annonce indique <strong>{nombreAnnonce} tomes</strong>
              {serieAnnoncee ? (
                <>
                  {' '}
                  de <strong>{serieAnnoncee}</strong>
                </>
              ) : null}
              , sans dire lesquels.
            </span>
          </p>
          <p className="text-xs text-textDim">
            {serieAnnoncee
              ? 'Précisez les tomes ci-dessous, ou envoyez les photos : elles le disent souvent mieux que le texte.'
              : "Aucune série n'est nommée. Envoyez les photos, ou saisissez le lot à la main."}
          </p>
          {serieAnnoncee && (
            <button
              type="button"
              onClick={() => onPrefillSeries(serieAnnoncee)}
              className="btn-secondaire self-start"
            >
              Renseigner les tomes de {serieAnnoncee}
            </button>
          )}
        </div>
      )}

      {/* The safety net that this number makes possible. A note, never a block:
          the user may deliberately keep only part of the batch. But
          entering 6 volumes where the listing announces 9 gives a flattering price per
          volume, so a verdict that is too favourable - and they must see that. */}
      {nombreAnnonce !== null && tomesDansLeLot > 0 && tomesDansLeLot !== nombreAnnonce && (
        <p className="flex items-start gap-1.5 text-xs text-textDim" role="status">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          Le lot en contient {tomesDansLeLot} pour {nombreAnnonce} annoncés
          {tomesDansLeLot < nombreAnnonce
            ? " — le prix par tome sera calculé sur ce que tu as saisi."
            : " — vérifie que tu n'en as pas ajouté en trop."}
        </p>
      )}

      {resultat && groupes.length === 0 && !mutation.isPending && nombreAnnonce === null && (
        <p className="text-xs text-textDim">
          Rien n'a pu être détecté automatiquement. Ajoutez les tomes à la main juste en dessous.
        </p>
      )}

      {groupes.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {groupes.map((groupe) => (
              <GroupeSerie
                key={groupe.cle}
                groupe={groupe}
                editionChoisie={editionDeGroupe(groupe)}
                estCoche={estCoche}
                estDansLeLot={estDansLeLot}
                onEdition={(nom) => choisirEdition(groupe, nom)}
                onBasculerTome={(ligne) =>
                  corriger(
                    ligne.cle,
                    estCoche(ligne) ? { decoche: true, coche: false } : { coche: true, decoche: false },
                  )
                }
                onBasculerTout={(cocher) => basculerGroupe(groupe, cocher)}
                onRetirer={() => groupe.lignes.forEach((ligne) => corriger(ligne.cle, { retire: true }))}
              />
            ))}
          </div>

          {resultat && resultat.unidentifiedCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-textDim">
              <HelpCircle size={13} className="shrink-0" />
              {resultat.unidentifiedCount} élément{resultat.unidentifiedCount > 1 ? 's' : ''} visible
              {resultat.unidentifiedCount > 1 ? 's' : ''} sur les photos mais non identifié
              {resultat.unidentifiedCount > 1 ? 's' : ''} — à ajouter à la main si besoin.
            </p>
          )}

          <button
            type="button"
            onClick={() => onConfirm(confirmables)}
            disabled={confirmables.length === 0}
            className="btn-secondaire"
          >
            Ajouter {confirmables.length} tome{confirmables.length > 1 ? 's' : ''} au lot
          </button>
        </>
      )}
    </div>
  )
}

function GroupeSerie({
  groupe,
  editionChoisie,
  estCoche,
  estDansLeLot,
  onEdition,
  onBasculerTome,
  onBasculerTout,
  onRetirer,
}: {
  groupe: Groupe
  editionChoisie: string | null
  estCoche: (ligne: Ligne) => boolean
  estDansLeLot: (ligne: Ligne) => boolean
  onEdition: (editionName: string) => void
  onBasculerTome: (ligne: Ligne) => void
  onBasculerTout: (cocher: boolean) => void
  onRetirer: () => void
}) {
  const restantes = groupe.lignes.filter((ligne) => !estDansLeLot(ligne))
  const toutesCochees = restantes.length > 0 && restantes.every(estCoche)
  const aDesTomesCoches = restantes.some(estCoche)

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <TexteCoupe texte={groupe.seriesTitle} className="truncate text-sm font-medium text-textPrimary" />
          <span className="flex flex-wrap items-center gap-x-2 text-xs">
            {/* The provenance speaks of the data, never of the AI provider. */}
            <span className="text-textDim">{groupe.sourceLabels.join(' + ')}</span>
            <span className={COULEURS_CONFIANCE[groupe.confiance]}>
              {LIBELLES_CONFIANCE[groupe.confiance]}
            </span>
            {groupe.catalogStatus === 'NOT_IN_CATALOG' && (
              <span className="text-warning">pas encore dans votre catalogue</span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={onRetirer}
          aria-label={`Retirer les propositions ${groupe.seriesTitle}`}
          className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3 text-textDim hover:text-dangerText"
        >
          <X size={14} />
        </button>
      </div>

      {/* The volumes as chips: fourteen volumes fit on two lines instead
          of fourteen cards. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {groupe.lignes.map((ligne) => {
          const dansLeLot = estDansLeLot(ligne)
          const coche = estCoche(ligne)
          const numero = ligne.item.volumeNumber
          const libelle = numero === null ? 'tome non lu' : `T${numero}`
          return (
            <button
              key={ligne.cle}
              type="button"
              onClick={() => !dansLeLot && onBasculerTome(ligne)}
              disabled={dansLeLot}
              role="checkbox"
              aria-checked={dansLeLot || coche}
              aria-label={`${libelle} de ${groupe.seriesTitle}${dansLeLot ? ', déjà dans le lot' : ''}`}
              className={`flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-xs font-medium ${
                dansLeLot
                  ? 'bg-okTint text-ok'
                  : coche
                    ? 'bg-accent text-accentInk'
                    : 'bg-surface2 text-textDim'
              }`}
            >
              {dansLeLot && <Check size={11} />}
              {libelle}
            </button>
          )
        })}

        {restantes.length > 1 && (
          <button
            type="button"
            onClick={() => onBasculerTout(!toutesCochees)}
            className="min-h-11 rounded-lg px-2.5 text-xs font-medium text-textDim underline underline-offset-2"
          >
            {toutesCochees ? 'tout décocher' : 'tout cocher'}
          </button>
        )}
      </div>

      {/* Once for the series: the edition is not a property of the volume. */}
      {restantes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-textDim">Édition :</span>
          {groupe.editionOptions.map((option) => (
            <button
              key={option.editionId}
              type="button"
              onClick={() => onEdition(option.editionName)}
              aria-pressed={editionChoisie === option.editionName}
              className={`min-h-11 rounded-lg px-2.5 text-xs font-medium ${
                editionChoisie === option.editionName
                  ? 'bg-accent text-accentInk'
                  : 'bg-surface2 text-textPrimary'
              }`}
            >
              {option.editionName}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onEdition(EDITION_INCONNUE)}
            aria-pressed={editionChoisie === EDITION_INCONNUE}
            className={`min-h-11 rounded-lg px-2.5 text-xs font-medium ${
              editionChoisie === EDITION_INCONNUE
                ? 'bg-accent text-accentInk'
                : 'bg-surface2 text-textDim'
            }`}
          >
            Je ne sais pas
          </button>
          {editionChoisie && editionChoisie !== EDITION_INCONNUE && (
            <span className="text-xs font-medium text-textPrimary">{editionChoisie}</span>
          )}
        </div>
      )}

      {/* Said only when it really blocks: a ticked chip that does not
          count in the counter reads as a bug. */}
      {aDesTomesCoches && !editionChoisie && (
        <p className="text-xs text-warning" role="status">
          Choisissez l'édition pour pouvoir ajouter ces tomes au lot.
        </p>
      )}
    </div>
  )
}
