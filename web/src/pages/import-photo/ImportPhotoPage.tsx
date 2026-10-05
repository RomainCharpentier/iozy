import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Camera, Check, HelpCircle, X } from 'lucide-react'
import { analyserLEtagere, importerDepuisLEtagere } from '@/common/api/shelfImport'
import { preparerLesPhotos } from '@/common/lib/photosAAnalyser'
import { resumerNumeros } from '@/common/lib/numerosDeTomes'
import type { EtatCadre } from './PhotoAnnotee'
import { ValidationUnParUn, type Extrait } from './ValidationUnParUn'
import {
  COULEURS_CONFIANCE,
  LIBELLES_CONFIANCE,
  MESSAGES_VISION,
  RANG_CONFIANCE,
  cleSerie,
  identite,
} from '@/common/lib/reconnaissance'
import { invaliderApresPossession } from '@/common/lib/invalidations'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import type { EditionOptionDto, RecognitionConfidence } from '@/common/types/listingRecognition'
import type {
  FicheProposeeDto,
  RapportImportEtagereDto,
  ShelfAnalysisDto,
  ShelfItemDto,
  TomeAImporter,
} from '@/common/types/shelfImport'

/**
 * Import your library from photos of the shelf.
 *
 * <h2>The same check screen as the listing analysis</h2>
 * The photos are read by the same engine, and rendered the same way:
 * one series per group, the volumes as pills, the edition chosen once
 * per series. What changes is the question asked: on a listing, "what
 * does this lot contain?"; on one's shelf, "what is still missing from my
 * collection?". Hence the **already owned** volumes, checked and inert, and the
 * **proposed work page** for a series that is still unknown to the catalog.
 *
 * <h2>Nothing is written before the gesture - and the gesture comes in two steps</h2>
 * The reading creates nothing. "Vérifier l'ajout de N tomes" moves to a
 * review that shows, series by series, what would be sent; it is there that
 * "Ajouter N tomes à ma collection" sends exactly what is checked -
 * title, number, edition, work page kept or not - and the server writes in one
 * transaction, refusing to create a second copy of a volume that is still
 * owned. Asked for after the first try on a real shelf: everything
 * pre-checked, one single click wrote 33 volumes.
 *
 * <h2>The photos leave the machine</h2>
 * The subtitle says so before the choice of files, and nothing is sent without this
 * choice: it is the consent, not a separate flag.
 */

/** "Je ne sais pas": the volume is added without an edition. */
const SANS_EDITION = ''

interface Correction {
  coche?: boolean
  decoche?: boolean
  /** The number typed when the photo did not give it. */
  numero?: number
}

interface Ligne {
  entree: ShelfItemDto
  cle: string
}

interface Groupe {
  cle: string
  titre: string
  catalogStatus: ShelfItemDto['item']['catalogStatus']
  editionLue: string | null
  editionOptions: EditionOptionDto[]
  sourceLabels: string[]
  confiance: RecognitionConfidence
  proposal: FicheProposeeDto | null
  proposalByTitle: boolean
  lignes: Ligne[]
}

/** A series as the review shows it: what would be sent, and nothing else. */
interface SerieARelire {
  groupe: Groupe
  numeros: number[]
}

function pluriel(n: number, un: string, plusieurs: string): string {
  return n > 1 ? plusieurs : un
}

/** A local URL to show the photo - empty where the browser cannot build one (jsdom). */
function creerUrl(fichier: File): string {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(fichier) : ''
}

function revoquerUrl(url: string) {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
}

export function ImportPhotoPage() {
  const queryClient = useQueryClient()
  const champFichiers = useRef<HTMLInputElement | null>(null)
  const [resultat, setResultat] = useState<ShelfAnalysisDto | null>(null)
  const [refusees, setRefusees] = useState<string | null>(null)
  /** Corrections indexed by candidate identity - never by position. */
  const [corrections, setCorrections] = useState<Record<string, Correction>>({})
  /** The edition chosen per series; absent = not chosen yet, '' = without edition. */
  const [editions, setEditions] = useState<Record<string, string>>({})
  /** The proposed work page, kept or not - explicitly; without a choice, the default rule applies (see ficheGardee). */
  const [fichesChoisies, setFichesChoisies] = useState<Record<string, boolean>>({})
  const [groupesRetires, setGroupesRetires] = useState<Record<string, boolean>>({})
  /**
   * Two steps before writing: check (check, correct, choose), then
   * reread in black and white what would be sent. The button of the first screen only
   * moves to the second; only the one of the review writes.
   */
  const [etape, setEtape] = useState<'verification' | 'unparun' | 'relecture'>('verification')
  /** The photos sent, as the browser can show them: local URLs, revoked when they change. */
  const [urls, setUrls] = useState<string[]>([])
  const [tailles, setTailles] = useState<Record<number, { w: number; h: number }>>({})
  /** The excerpt currently shown in the one-by-one validation. */
  const [pas, setPas] = useState(0)
  useEffect(() => () => urls.forEach(revoquerUrl), [urls])

  const lecture = useMutation({
    mutationFn: analyserLEtagere,
    onSuccess: (reponse) => {
      setResultat(reponse)
      setCorrections({})
      setEditions({})
      setFichesChoisies({})
      setGroupesRetires({})
      // The check is one by one: as soon as there is something to
      // validate, we enter it directly; the summary by series comes
      // after. With nothing to validate (all owned, nothing read), the summary
      // says why.
      setEtape(reponse.items.some((entree) => !entree.alreadyOwned) ? 'unparun' : 'verification')
      setPas(0)
    },
  })

  const importation = useMutation({
    mutationFn: importerDepuisLEtagere,
    onSuccess: () => invaliderApresPossession(queryClient),
  })

  const choisirPhotos = (liste: FileList | null) => {
    setRefusees(null)
    if (!liste || liste.length === 0) return
    // Copied BEFORE emptying the field: the FileList is live, emptying it
    // would also empty what we are holding.
    const fichiers = Array.from(liste)
    if (champFichiers.current) champFichiers.current.value = ''

    void preparerLesPhotos(fichiers).then(({ retenues, message }) => {
      setRefusees(message)
      if (retenues.length > 0) {
        // The previous reading is cleared right away: leaving it on screen
        // during the new one would make one reread volumes of another photo, or
        // from before the import - "already owned" would be wrong there.
        setResultat(null)
        setUrls(retenues.map(creerUrl))
        setTailles({})
        importation.reset()
        lecture.mutate(retenues)
      }
    })
  }

  // ----------------------------------------------------------- The groups

  const lignes: Ligne[] = (resultat?.items ?? []).map((entree, index) => ({
    entree,
    // The index only serves to separate two "unread volume" of the same series:
    // without it, they would share an identity, therefore a same typed number.
    cle: `${identite(entree.item)}#${index}`,
  }))

  /**
   * One series per group. The edition **read** is part of the key: if the photos
   * distinguish "Perfect" and "Standard", they are two groups - merging them
   * would choose in place of the user.
   */
  const groupes: Groupe[] = []
  for (const ligne of lignes) {
    const item = ligne.entree.item
    const cle = `${cleSerie(item)}|${(item.editionHint ?? '').toLowerCase()}`
    if (groupesRetires[cle]) continue
    const existant = groupes.find((g) => g.cle === cle)
    if (existant) {
      existant.lignes.push(ligne)
      if (RANG_CONFIANCE[item.confidence] < RANG_CONFIANCE[existant.confiance]) {
        existant.confiance = item.confidence
      }
      if (!existant.proposal && ligne.entree.proposal) {
        existant.proposal = ligne.entree.proposal
        existant.proposalByTitle = ligne.entree.proposalByTitle
      }
      continue
    }
    groupes.push({
      cle,
      titre: item.seriesTitle,
      catalogStatus: item.catalogStatus,
      editionLue: item.editionHint,
      editionOptions: item.editionOptions,
      sourceLabels: item.sourceLabels,
      confiance: item.confidence,
      proposal: ligne.entree.proposal,
      proposalByTitle: ligne.entree.proposalByTitle,
      lignes: [ligne],
    })
  }

  function numeroDe(ligne: Ligne): number | null {
    return ligne.entree.item.volumeNumber ?? corrections[ligne.cle]?.numero ?? null
  }

  function estCoche(ligne: Ligne): boolean {
    if (ligne.entree.alreadyOwned) return true
    const correction = corrections[ligne.cle]
    if (correction?.decoche) return false
    if (correction?.coche) return true
    // Pre-checked: what the engine considers certain (clear title AND number), series
    // known OR new - on a shelf, a new series is precisely
    // what one comes to import, whereas a listing lot only pre-checks the
    // catalog. Never without a number: nothing to add until it is typed.
    const item = ligne.entree.item
    return item.preselected || (item.catalogStatus === 'NOT_IN_CATALOG' && item.confidence === 'HIGH')
  }

  function estImportable(ligne: Ligne): boolean {
    return !ligne.entree.alreadyOwned && estCoche(ligne) && numeroDe(ligne) !== null
  }

  /**
   * The edition kept for a series. Known from the catalog: its own. To
   * confirm: nothing until the user has chosen - a single known edition
   * is not a reason to assign it to them. New series: what
   * the photo said, if there was something.
   */
  function editionDe(groupe: Groupe): string {
    const choisie = editions[groupe.cle]
    if (choisie !== undefined) return choisie
    if (groupe.catalogStatus === 'EDITION_TO_CONFIRM') return SANS_EDITION
    return groupe.editionLue ?? SANS_EDITION
  }

  /**
   * The work page that will go with the series. Found by its title: kept
   * by default. Simple first search result (French title read, work page
   * in romaji): shown as a lead, kept only if the user says
   * so - a wrong work page imported with confidence costs more than a series
   * created with its title alone.
   */
  function ficheGardee(groupe: Groupe): FicheProposeeDto | null {
    if (groupe.catalogStatus !== 'NOT_IN_CATALOG' || !groupe.proposal) return null
    const gardee = fichesChoisies[groupe.cle] ?? groupe.proposalByTitle
    return gardee ? groupe.proposal : null
  }

  /** The title sent: the one of the kept work page, otherwise the one of the catalog or of the reading. */
  function titreDe(groupe: Groupe): string {
    return ficheGardee(groupe)?.title ?? groupe.titre
  }

  function corriger(cle: string, patch: Correction) {
    setCorrections((prev) => ({ ...prev, [cle]: { ...prev[cle], ...patch } }))
  }

  /** Check or uncheck everything in a series - the owned volumes do not move. */
  function basculerGroupe(groupe: Groupe, cocher: boolean) {
    setCorrections((prev) => {
      const suivant = { ...prev }
      for (const ligne of groupe.lignes) {
        if (ligne.entree.alreadyOwned) continue
        suivant[ligne.cle] = { ...suivant[ligne.cle], coche: cocher, decoche: !cocher }
      }
      return suivant
    })
  }

  function tomesAImporter(): TomeAImporter[] {
    return groupes.flatMap((groupe) => {
      const edition = editionDe(groupe)
      const fiche = ficheGardee(groupe)
      return groupe.lignes.filter(estImportable).map((ligne) => {
        const tome: TomeAImporter = { seriesTitle: titreDe(groupe), volumeNumber: numeroDe(ligne) as number }
        if (edition) tome.edition = edition
        if (fiche) {
          tome.attributes = fiche.attributes
          if (fiche.imageUrl) tome.coverImageUrl = fiche.imageUrl
        }
        return tome
      })
    })
  }

  const aImporter = tomesAImporter()
  /** What the review displays: by series, the numbers that would be sent. */
  const relecture: SerieARelire[] = groupes
    .map((groupe) => ({
      groupe,
      numeros: groupe.lignes.filter(estImportable).map((ligne) => numeroDe(ligne) as number),
    }))
    .filter((serie) => serie.numeros.length > 0)
  const dejaPossedes = lignes.filter((ligne) => ligne.entree.alreadyOwned).length
  const enCours = lecture.isPending || importation.isPending

  // ------------------------------------------- The frames on the photo, the excerpts

  /** The state of a volume, the same on its pill and on its frame. */
  function etatDe(ligne: Ligne): EtatCadre {
    if (ligne.entree.alreadyOwned) return 'possede'
    if (numeroDe(ligne) === null) return 'sansNumero'
    return estCoche(ligne) ? 'coche' : 'decoche'
  }

  /** The lines still on screen, with their series - a removed series takes its frames with it. */
  const lignesEnPlace = lignes.flatMap((ligne) => {
    const groupe = groupes.find((g) => g.lignes.includes(ligne))
    return groupe ? [{ ligne, groupe }] : []
  })

  /**
   * What the one-by-one validation scrolls through: by photo, from left to
   * right - the order of a row - then what the engine could not place.
   * An already owned volume has nothing to validate.
   */
  const extraits: Extrait[] = lignesEnPlace
    .filter(({ ligne }) => !ligne.entree.alreadyOwned)
    .map(({ ligne, groupe }) => ({
      cle: ligne.cle,
      titre: groupe.titre,
      numero: numeroDe(ligne),
      editionLue: ligne.entree.item.editionHint,
      confiance: ligne.entree.item.confidence,
      indice: ligne.entree.item.evidence.join(' · '),
      box: ligne.entree.item.boxes[0] ?? null,
      etat: etatDe(ligne),
    }))
    .sort((a, b) => {
      if (!a.box || !b.box) return Number(!a.box) - Number(!b.box)
      return a.box.image - b.box.image || a.box.left - b.box.left
    })


  const messageVision =
    resultat && !(resultat.visionStatus === 'NOTHING_RECOGNIZED' && resultat.items.length > 0)
      ? MESSAGES_VISION[resultat.visionStatus]
      : ''

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/add', libelle: 'Catalogue' }} />

      <EnTeteSection
        niveau={1}
        titre="Importer depuis une photo"
        sousTitre="Photographie une rangée de ta bibliothèque, de face et bien nette. IozyCore y lit les séries et les tomes, tu vérifies, puis tu ajoutes. Les photos sont envoyées à un service d'analyse d'images et ne sont pas conservées."
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => champFichiers.current?.click()}
            disabled={enCours}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 ${
              resultat ? 'bg-surface text-textPrimary shadow-token-sm' : 'bg-accent text-accentInk'
            }`}
          >
            <Camera size={16} />
            {lecture.isPending ? 'Lecture…' : resultat ? 'Analyser d’autres photos' : 'Choisir des photos'}
          </button>
          <span className="text-xs text-textDim">Jusqu’à 8 photos, une rangée par photo.</span>
        </div>
        <input
          ref={champFichiers}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => choisirPhotos(e.target.files)}
          className="hidden"
          aria-label="Choisir des photos de l’étagère"
        />
        {refusees && (
          <p className="text-xs text-textDim" role="status">
            {refusees}
          </p>
        )}
        {lecture.isPending && (
          <p className="text-xs text-textDim" role="status">
            Lecture en cours…
          </p>
        )}
        {lecture.isError && (
          <ErrorBanner message="La lecture a échoué. Réessaie, ou ajoute les tomes depuis le Catalogue." />
        )}
      </div>

      {importation.data ? (
        <Rapport rapport={importation.data} />
      ) : resultat && etape === 'unparun' ? (
        <ValidationUnParUn
          extraits={extraits}
          index={pas}
          urls={urls}
          tailles={tailles}
          onTaille={(image, taille) => setTailles((prev) => ({ ...prev, [image]: taille }))}
          onConfirmer={(cle, numero) => {
            corriger(cle, numero === null ? { coche: true, decoche: false } : { coche: true, decoche: false, numero })
            setPas((p) => p + 1)
          }}
          onEcarter={(cle) => {
            corriger(cle, { decoche: true, coche: false })
            setPas((p) => p + 1)
          }}
          onAller={(index) => setPas(Math.max(0, index))}
          onTerminer={() => setEtape('verification')}
        />
      ) : resultat && etape === 'relecture' ? (
        <Relecture
          series={relecture}
          titreDe={titreDe}
          editionDe={editionDe}
          ficheGardee={ficheGardee}
          enCours={enCours}
          onAjouter={() => importation.mutate(aImporter)}
          onRevenir={() => setEtape('verification')}
        />
      ) : (
        resultat && (
          <section aria-labelledby="titre-lecture" className="flex flex-col gap-3">
            <EnTeteSection
              niveau={2}
              titre={<span id="titre-lecture">Ce que la photo montre</span>}
              sousTitre={
                lignes.length === 0
                  ? 'Rien n’a pu être lu. Essaie une photo plus proche, une rangée à la fois.'
                  : `${lignes.length} ${pluriel(lignes.length, 'tome lu', 'tomes lus')} sur ${resultat.analyzedImageCount} ${pluriel(resultat.analyzedImageCount, 'photo', 'photos')}${
                      dejaPossedes > 0 ? `, dont ${dejaPossedes} ${pluriel(dejaPossedes, 'déjà possédé', 'déjà possédés')}` : ''
                    }. Vérifie, puis ajoute.`
              }
            />

            {messageVision && (
              <p className="flex items-start gap-1.5 text-xs text-textDim" role="status">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {messageVision}
              </p>
            )}

            {resultat.requestedImageCount > resultat.analyzedImageCount && (
              <p className="flex items-start gap-1.5 text-xs text-textDim" role="status">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {resultat.requestedImageCount - resultat.analyzedImageCount} photo(s) sur{' '}
                {resultat.requestedImageCount} n’étaient pas lisibles.
              </p>
            )}

            {/* The check is done one by one, on the photo; this summary
                serves to check in bulk, choose the edition and the work page per series,
                and to go over it again if needed. */}
            {extraits.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPas(0)
                  setEtape('unparun')
                }}
                className="btn-secondaire self-start"
              >
                Valider un par un ({extraits.length})
              </button>
            )}

            <>
            {groupes.length > 0 && (
              <div className="flex flex-col gap-2">
                {groupes.map((groupe) => (
                  <GroupeEtagere
                    key={groupe.cle}
                    groupe={groupe}
                    editionChoisie={editionDe(groupe)}
                    ficheGardee={ficheGardee(groupe) !== null}
                    numeroDe={numeroDe}
                    estCoche={estCoche}
                    onEdition={(nom) => setEditions((prev) => ({ ...prev, [groupe.cle]: nom }))}
                    onFiche={(garder) => setFichesChoisies((prev) => ({ ...prev, [groupe.cle]: garder }))}
                    onBasculerTome={(ligne) =>
                      corriger(
                        ligne.cle,
                        estCoche(ligne) ? { decoche: true, coche: false } : { coche: true, decoche: false },
                      )
                    }
                    onBasculerTout={(cocher) => basculerGroupe(groupe, cocher)}
                    onNumero={(ligne, numero) =>
                      corriger(ligne.cle, { numero, coche: numero !== undefined, decoche: false })
                    }
                    onRetirer={() => setGroupesRetires((prev) => ({ ...prev, [groupe.cle]: true }))}
                  />
                ))}
              </div>
            )}

            {resultat.unidentifiedCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-textDim">
                <HelpCircle size={13} className="shrink-0" />
                {resultat.unidentifiedCount} {pluriel(resultat.unidentifiedCount, 'livre visible', 'livres visibles')} mais non{' '}
                {pluriel(resultat.unidentifiedCount, 'identifié', 'identifiés')} - à ajouter depuis le Catalogue si besoin.
              </p>
            )}

            {resultat.lookupsSkipped > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-textDim">
                <HelpCircle size={13} className="shrink-0" />
                {resultat.lookupsSkipped} {pluriel(resultat.lookupsSkipped, 'série nouvelle n’a', 'séries nouvelles n’ont')} pas été{' '}
                {pluriel(resultat.lookupsSkipped, 'cherchée', 'cherchées')} chez les sources (trop d’un coup) : elles seraient créées avec leur seul titre.
              </p>
            )}

            {/* Not the add yet: this button moves to the review, where what
                would be sent is shown in black and white. The writing comes
                from there, and only from there. */}
            {lignes.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEtape('relecture')}
                  disabled={aImporter.length === 0 || enCours}
                  className="btn-primaire"
                >
                  {aImporter.length === 0
                    ? 'Rien de coché à ajouter'
                    : `Vérifier l’ajout de ${aImporter.length} ${pluriel(aImporter.length, 'tome', 'tomes')}`}
                </button>
                {aImporter.length === 0 && dejaPossedes === lignes.length && (
                  <span className="text-xs text-textDim">Tout ce qui a été lu est déjà dans ta collection.</span>
                )}
              </div>
            )}
            </>
          </section>
        )
      )}

      {importation.isError && (
        <ErrorBanner message="L’ajout a échoué : rien n’a été écrit. Tu peux réessayer." />
      )}
    </div>
  )
}

function GroupeEtagere({
  groupe,
  editionChoisie,
  ficheGardee,
  numeroDe,
  estCoche,
  onEdition,
  onFiche,
  onBasculerTome,
  onBasculerTout,
  onNumero,
  onRetirer,
}: {
  groupe: Groupe
  editionChoisie: string
  ficheGardee: boolean
  numeroDe: (ligne: Ligne) => number | null
  estCoche: (ligne: Ligne) => boolean
  onEdition: (editionName: string) => void
  onFiche: (garder: boolean) => void
  onBasculerTome: (ligne: Ligne) => void
  onBasculerTout: (cocher: boolean) => void
  onNumero: (ligne: Ligne, numero: number | undefined) => void
  onRetirer: () => void
}) {
  const aChoisir = groupe.lignes.some((ligne) => !ligne.entree.alreadyOwned)
  const nouvelle = groupe.catalogStatus === 'NOT_IN_CATALOG'
  const selectionnables = groupe.lignes.filter((ligne) => !ligne.entree.alreadyOwned && numeroDe(ligne) !== null)
  const toutesCochees = selectionnables.length > 0 && selectionnables.every(estCoche)
  /** What the reader saw for this volume ("Chiffre 62 sur la tranche") - on hover, to check by hand. */
  const indice = (ligne: Ligne) => ligne.entree.item.evidence.join(' · ') || undefined

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <TexteCoupe texte={groupe.titre} className="truncate text-sm font-medium text-textPrimary" />
          <span className="flex flex-wrap items-center gap-x-2 text-xs">
            {/* The provenance speaks of the data ("photos"), never of the AI provider. */}
            <span className="text-textDim">{groupe.sourceLabels.join(' + ')}</span>
            <span className={COULEURS_CONFIANCE[groupe.confiance]}>{LIBELLES_CONFIANCE[groupe.confiance]}</span>
            {nouvelle ? (
              <span className="text-warning">nouvelle série</span>
            ) : (
              <span className="text-textDim">dans ton catalogue</span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={onRetirer}
          aria-label={`Retirer ${groupe.titre}`}
          className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3 text-textDim hover:text-dangerText"
        >
          <X size={14} />
        </button>
      </div>

      {/* The work page that the Catalog would create: shown BEFORE the import, with its
          cover, and refusable - a spine reading can get the series
          wrong, and the wrong work page would then have the confidence of a real one. */}
      {nouvelle && groupe.proposal && (
        <div className="flex items-center gap-2">
          <Jaquette
            src={groupe.proposal.imageUrl}
            className="h-12 w-8 shrink-0 rounded object-cover"
            repli={<span className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-surface2 text-xs text-textDim">?</span>}
          />
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-textDim">
              {groupe.proposalByTitle ? 'Fiche proposée' : 'Fiche possible, à vérifier'}
            </span>
            <TexteCoupe texte={groupe.proposal.title} className="truncate text-sm text-textPrimary" />
          </div>
          <button
            type="button"
            onClick={() => onFiche(!ficheGardee)}
            aria-pressed={ficheGardee}
            className={`ml-auto min-h-11 shrink-0 rounded-lg px-2.5 text-xs font-medium ${
              ficheGardee ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
            }`}
          >
            {ficheGardee ? 'Fiche gardée' : 'Sans la fiche'}
          </button>
        </div>
      )}
      {nouvelle && !groupe.proposal && (
        <p className="text-xs text-textDim">Aucune fiche trouvée chez les sources : la série sera créée avec ce titre.</p>
      )}

      {/* The volumes as pills: fourteen volumes fit on two lines. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {groupe.lignes.map((ligne) => {
          const possede = ligne.entree.alreadyOwned
          const coche = estCoche(ligne)
          const numero = numeroDe(ligne)
          if (ligne.entree.item.volumeNumber === null) {
            return (
              <label
                key={ligne.cle}
                title={indice(ligne)}
                className={`flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-xs font-medium ${
                  coche && numero !== null ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
                }`}
              >
                tome non lu, n°
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  aria-label={`Numéro du tome non lu de ${groupe.titre}`}
                  value={numero ?? ''}
                  onChange={(e) => onNumero(ligne, e.target.value ? Number(e.target.value) : undefined)}
                  className="w-12 rounded bg-surface px-1 text-textPrimary focus:outline-none"
                />
              </label>
            )
          }
          const libelle = `T${numero}`
          return (
            <button
              key={ligne.cle}
              type="button"
              onClick={() => !possede && onBasculerTome(ligne)}
              disabled={possede}
              role="checkbox"
              aria-checked={coche}
              aria-label={`${libelle} de ${groupe.titre}${possede ? ', déjà possédé' : ''}`}
              title={indice(ligne)}
              className={`flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-xs font-medium ${
                possede ? 'bg-okTint text-ok' : coche ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
              }`}
            >
              {possede && <Check size={11} />}
              {libelle}
            </button>
          )
        })}

        {/* For whoever prefers to start from nothing and check by hand, volume by volume. */}
        {selectionnables.length > 1 && (
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
      {aChoisir && groupe.catalogStatus === 'MATCHED' && groupe.editionLue && (
        <p className="text-xs text-textDim">
          Édition : <span className="font-medium text-textPrimary">{groupe.editionLue}</span>
        </p>
      )}
      {aChoisir && groupe.catalogStatus !== 'MATCHED' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-textDim">Édition :</span>
          {groupe.editionOptions.map((option) => (
            <button
              key={option.editionId}
              type="button"
              onClick={() => onEdition(option.editionName)}
              aria-pressed={editionChoisie === option.editionName}
              className={`min-h-11 rounded-lg px-2.5 text-xs font-medium ${
                editionChoisie === option.editionName ? 'bg-accent text-accentInk' : 'bg-surface2 text-textPrimary'
              }`}
            >
              {option.editionName}
            </button>
          ))}
          {/* What the photo says about the edition ("Masked", "Perfect") is worth
              proposing even when the series is already in the catalog: its
              known editions do not necessarily cover it. */}
          {groupe.editionLue && !groupe.editionOptions.some((option) => option.editionName === groupe.editionLue) && (
            <button
              type="button"
              onClick={() => onEdition(groupe.editionLue as string)}
              aria-pressed={editionChoisie === groupe.editionLue}
              className={`min-h-11 rounded-lg px-2.5 text-xs font-medium ${
                editionChoisie === groupe.editionLue ? 'bg-accent text-accentInk' : 'bg-surface2 text-textPrimary'
              }`}
            >
              {groupe.editionLue} (lu sur la photo)
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdition(SANS_EDITION)}
            aria-pressed={editionChoisie === SANS_EDITION}
            className={`min-h-11 rounded-lg px-2.5 text-xs font-medium ${
              editionChoisie === SANS_EDITION ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
            }`}
          >
            Je ne sais pas
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * The review: what would be sent, series by series, in black and white - and the
 * only button that writes. Nothing shown here is in the
 * collection yet; "Revenir" goes back to the check without losing anything.
 */
function Relecture({
  series,
  titreDe,
  editionDe,
  ficheGardee,
  enCours,
  onAjouter,
  onRevenir,
}: {
  series: SerieARelire[]
  titreDe: (groupe: Groupe) => string
  editionDe: (groupe: Groupe) => string
  ficheGardee: (groupe: Groupe) => FicheProposeeDto | null
  enCours: boolean
  onAjouter: () => void
  onRevenir: () => void
}) {
  const tomes = series.reduce((total, serie) => total + serie.numeros.length, 0)
  const creees = series.filter((serie) => serie.groupe.catalogStatus === 'NOT_IN_CATALOG').length

  return (
    <section aria-labelledby="titre-relecture" className="flex flex-col gap-3">
      <EnTeteSection
        niveau={2}
        titre={<span id="titre-relecture">Ce qui sera ajouté</span>}
        sousTitre={`${tomes} ${pluriel(tomes, 'tome', 'tomes')} dans ${series.length} ${pluriel(series.length, 'série', 'séries')}${
          creees > 0 ? `, dont ${creees} ${pluriel(creees, 'série créée', 'séries créées')}` : ''
        }. Rien n’est écrit tant que tu n’as pas confirmé.`}
      />

      <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface px-3">
        {series.map(({ groupe, numeros }) => {
          const edition = editionDe(groupe)
          const fiche = ficheGardee(groupe)
          const nouvelle = groupe.catalogStatus === 'NOT_IN_CATALOG'
          return (
            <li key={groupe.cle} className="flex flex-col gap-0.5 py-2 text-sm">
              <span className="font-medium text-textPrimary">{titreDe(groupe)}</span>
              <span className="text-textPrimary">
                {numeros.length} {pluriel(numeros.length, 'tome', 'tomes')} : {resumerNumeros(numeros)}
              </span>
              <span className="text-xs text-textDim">
                {edition ? `édition ${edition}` : 'édition non renseignée'}
                {' · '}
                {nouvelle
                  ? fiche
                    ? `série créée avec la fiche « ${fiche.title} »`
                    : 'série créée avec ce seul titre'
                  : 'série déjà au catalogue'}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAjouter}
          disabled={enCours}
          className="btn-primaire"
        >
          {enCours ? 'Ajout…' : `Ajouter ${tomes} ${pluriel(tomes, 'tome', 'tomes')} à ma collection`}
        </button>
        <button
          type="button"
          onClick={onRevenir}
          disabled={enCours}
          className="btn-secondaire"
        >
          <ArrowLeft size={14} />
          Revenir à la vérification
        </button>
      </div>
    </section>
  )
}

function Rapport({ rapport }: { rapport: RapportImportEtagereDto }) {
  const parties = [`${rapport.added} ${pluriel(rapport.added, 'tome ajouté', 'tomes ajoutés')}`]
  if (rapport.seriesCreated > 0) {
    parties.push(`${rapport.seriesCreated} ${pluriel(rapport.seriesCreated, 'série créée', 'séries créées')}`)
  }
  if (rapport.alreadyOwned > 0) {
    parties.push(`${rapport.alreadyOwned} ${pluriel(rapport.alreadyOwned, 'déjà possédé', 'déjà possédés')}`)
  }

  return (
    <section aria-labelledby="titre-rapport-etagere" className="flex flex-col gap-3">
      <EnTeteSection
        niveau={2}
        titre={<span id="titre-rapport-etagere">Import terminé</span>}
        sousTitre={`${parties.join(' · ')}.`}
      />
      <ul className="flex flex-col divide-y divide-line rounded-xl bg-surface px-3">
        {rapport.items.map((tome, index) => (
          <li key={`${tome.entityId}-${tome.volumeNumber}-${index}`} className="flex items-center justify-between gap-2 py-2 text-sm">
            <Link to={`/entity/${tome.entityId}`} className="min-w-0 truncate text-textPrimary">
              {tome.seriesTitle} · T{tome.volumeNumber}
              {tome.edition ? ` · ${tome.edition}` : ''}
            </Link>
            <span className={`shrink-0 text-xs ${tome.outcome === 'ADDED' ? 'text-ok' : 'text-textDim'}`}>
              {tome.outcome === 'ADDED' ? (tome.seriesCreated ? 'ajouté, série créée' : 'ajouté') : 'déjà possédé'}
            </span>
          </li>
        ))}
      </ul>
      <Link to="/" className="self-start text-sm font-semibold text-accent underline underline-offset-2">
        Voir ma collection
      </Link>
    </section>
  )
}
