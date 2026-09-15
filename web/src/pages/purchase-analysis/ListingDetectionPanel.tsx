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
 * « Éléments détectés » : les propositions à vérifier avant de les verser dans
 * le contenu du lot.
 *
 * <h2>Groupé par série, parce que l'édition l'est</h2>
 * La première version affichait une carte par tome. Pour un lot de quatorze
 * tomes d'une même série, cela donnait **1878 px de haut — 2,6 écrans — et
 * quatorze champs d'édition identiques** à remplir un par un.
 *
 * Or l'édition n'est pas une propriété du tome : c'est une propriété de la
 * série. La demander quatorze fois pour la même œuvre n'était pas seulement
 * encombrant, c'était faux. Les propositions sont donc regroupées par série,
 * les tomes deviennent des pastilles cochables, et l'édition se choisit **une
 * fois par groupe**.
 *
 * <h2>Deux principes inchangés</h2>
 * Le texte est analysé gratuitement dès qu'il existe ; les photos ne partent
 * que sur un clic. Et une correction manuelle n'est jamais écrasée : les
 * corrections sont mémorisées par identité de candidat, pas par position.
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

/** Une série reconnue, avec les tomes qu'on lui attribue. */
interface Groupe {
  cle: string
  seriesTitle: string
  catalogStatus: RecognizedItemDto['catalogStatus']
  editionOptions: EditionOptionDto[]
  sourceLabels: string[]
  /** La plus basse du groupe : c'est elle qui doit inciter à vérifier. */
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
   * Reprend la main sur la saisie manuelle quand l'annonce nomme une série sans
   * dire quels tomes. Sans cela on renverrait l'utilisateur retaper « Naruto »,
   * un mot que le titre contenait déjà et qu'IozyCore a lu.
   */
  onPrefillSeries: (seriesTitle: string) => void
  /**
   * Combien de tomes le lot contient déjà. Sert uniquement à confronter la
   * saisie au nombre annoncé : un lot saisi incomplet donne un prix par tome
   * flatteur, et donc un verdict d'achat trop favorable.
   */
  tomesDansLeLot: number
  /**
   * Ce tome est-il déjà dans le contenu du lot ? Une proposition déjà versée
   * s'affiche cochée et inerte, plutôt que de paraître en attente.
   */
  dejaDansLeLot: (seriesTitle: string, editionName: string, volumeNumber: number) => boolean
  /** Reçoit les éléments confirmés — le parent les verse dans le contenu du lot. */
  onConfirm: (elements: ElementConfirme[]) => void
}) {
  const [resultat, setResultat] = useState<AnalyzeListingResponse | null>(null)
  /** Corrections indexées par identité de candidat — jamais par position. */
  const [corrections, setCorrections] = useState<Record<string, Correction>>({})

  const mutation = useMutation({
    mutationFn: (avecPhotos: boolean) =>
      analyzeListing({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        // Ne PAS envoyer les photos est ce qui garantit qu'aucun moteur ne
        // tourne. C'est le consentement, pas un drapeau à part.
        imageUrls: avecPhotos && imageUrls.length > 0 ? imageUrls : undefined,
        entityTypeCode: 'MANGA',
      }),
    onSuccess: (reponse) => setResultat(reponse),
  })

  /**
   * Les photos que l'utilisateur fournit lui-même.
   *
   * Chemin volontairement séparé de `mutation` : celle-ci part d'URLs que le
   * serveur va chercher, celle-là de fichiers déjà entre les mains du
   * navigateur. Les confondre obligerait à écrire « si l'un, alors pas
   * l'autre » — une règle qu'on finit toujours par lire de travers.
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
    // Copié AVANT de vider le champ : la FileList est vivante, la vider
    // viderait aussi ce qu'on tient.
    const fichiers = Array.from(liste)

    // Le champ est vidé pour que rechoisir le MÊME fichier relance bien une
    // analyse : sans cela, l'événement `change` ne se déclenche pas.
    if (champFichiers.current) champFichiers.current.value = ''

    // Réduction et tri partagés avec l'import d'étagère (photosAAnalyser) :
    // une photo de téléphone trop lourde est réduite plutôt qu'écartée, et
    // ce qui ne part pas est dit au moment du choix, en nommant la raison.
    void preparerLesPhotos(fichiers).then(({ retenues, message }) => {
      setRefusees(message)
      if (retenues.length > 0) envoiPhotos.mutate(retenues)
    })
  }

  const enCours = mutation.isPending || envoiPhotos.isPending

  const { mutate } = mutation
  const analyserTexte = useCallback(() => mutate(false), [mutate])

  // Analyse automatique du texte : local, déterministe, gratuit. Débouncée pour
  // ne pas relancer à chaque frappe quand l'utilisateur corrige le titre.
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
   * Rien à montrer encore — mais l'envoi de photos doit rester atteignable.
   *
   * Le panneau complet ne s'ouvre qu'une fois qu'il a quelque chose à proposer :
   * il avait déjà été jugé trop encombrant, et un en-tête vide en haut d'un
   * formulaire vierge n'apprend rien. Le cacher entièrement fermait pourtant la
   * porte dans le seul cas où elle sert vraiment : une annonce sans texte
   * exploitable, ou une plateforme dont les photos ne sont pas récupérables.
   * D'où cette version d'une ligne — le geste, sans le décor.
   */
  if (!resultat && !enCours) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => champFichiers.current?.click()}
          className="flex min-h-11 items-center gap-1.5 self-start rounded-lg bg-surface px-3.5 text-sm font-semibold text-textPrimary"
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

  /** L'édition retenue pour cette ligne : correction, sinon lecture. */
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
   * Les propositions, réunies par série. L'édition **lue** entre dans la clé :
   * si les photos distinguent « Perfect » et « Standard » de la même série, ce
   * sont deux groupes — les fondre choisirait à la place de l'utilisateur.
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

  /** Une édition choisie vaut pour toute la série : c'est sa propriété, pas celle d'un tome. */
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
   * Les photos ont-elles apporté quelque chose, par un moyen ou par un autre ?
   *
   * Un code-barres lu sur une photo est une proposition venue de la photo, même
   * quand le moteur de vision n'a rien vu — et c'est un cas courant, une image
   * de dos de manga ne montrant qu'un code. Sans cette distinction, l'écran
   * affichait « Les photos n'ont rien ajouté de lisible » juste au-dessus d'un
   * tome identifié par ces mêmes photos, avec un identifiant exact.
   */
  const photosOntApporte = (resultat?.items ?? []).some((item) =>
    item.sources.some((source) => source === 'EAN' || source === 'VISION'),
  )
  const messageVision =
    resultat?.visionStatus && !(resultat.visionStatus === 'NOTHING_RECOGNIZED' && photosOntApporte)
      ? MESSAGES_VISION[resultat.visionStatus]
      : ''

  // Le serveur ne renvoie ce nombre que tant que la question reste ouverte : dès
  // qu'un tome est identifié, il disparaît de lui-même. Rien à arbitrer ici.
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
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accentInk disabled:opacity-50"
            >
              <Sparkles size={14} />
              {mutation.isPending ? 'Analyse…' : analysePhotosFaite ? 'Relancer les photos' : 'Analyser les photos'}
            </button>
          )}

          {/* Toujours proposé, MÊME sans photo récupérée - c'est précisément ce
              cas qui était aveugle : une plateforme qui refuse la lecture
              automatique, ou une annonce dont le texte ne nomme aucune série.
              Discret quand des photos ont été récupérées, principal sinon. */}
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

      {/* « 9 tomes de Naruto » : l'annonce dit combien, pas lesquels.
          Rien n'est proposé - le vendeur peut avoir les tomes 14 à 22, et
          cocher 1 à 9 d'office donnerait un verdict faux avec l'aplomb d'un
          calcul. On dit ce qu'on sait, et on pose la seule question ouverte.

          Retiré dès que le lot contient quelque chose : la question a trouvé
          preneur, et le bouton de pré-remplissage écraserait alors la série
          que l'utilisateur vient de saisir. Le décompte, lui, reste surveillé
          juste en dessous. */}
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
              className="flex min-h-11 items-center gap-1.5 self-start rounded-lg bg-surface2 px-3 text-sm font-semibold text-textPrimary"
            >
              Renseigner les tomes de {serieAnnoncee}
            </button>
          )}
        </div>
      )}

      {/* Le filet que ce nombre rend possible. Une note, jamais un blocage :
          l'utilisateur peut délibérément ne retenir qu'une partie du lot. Mais
          saisir 6 tomes là où l'annonce en annonce 9 donne un prix par tome
          flatteur, donc un verdict trop favorable - et ça, il doit le voir. */}
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
            className="min-h-11 rounded-lg bg-surface px-3 text-sm font-semibold text-textPrimary disabled:opacity-40"
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
            {/* La provenance parle de la donnée, jamais du fournisseur d'IA. */}
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

      {/* Les tomes en pastilles : quatorze tomes tiennent sur deux lignes au
          lieu de quatorze cartes. */}
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

      {/* Une seule fois pour la série : l'édition n'est pas une propriété du tome. */}
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

      {/* Dit seulement quand ça bloque vraiment : une pastille cochée qui ne
          compte pas au compteur se lit comme un bug. */}
      {aDesTomesCoches && !editionChoisie && (
        <p className="text-xs text-warning" role="status">
          Choisissez l'édition pour pouvoir ajouter ces tomes au lot.
        </p>
      )}
    </div>
  )
}
