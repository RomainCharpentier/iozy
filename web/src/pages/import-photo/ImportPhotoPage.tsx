import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Camera, Check, HelpCircle, X } from 'lucide-react'
import { analyserLEtagere, importerDepuisLEtagere } from '@/common/api/shelfImport'
import { preparerLesPhotos } from '@/common/lib/photosAAnalyser'
import { resumerNumeros } from '@/common/lib/numerosDeTomes'
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
 * Importer sa bibliothèque depuis des photos de l'étagère.
 *
 * <h2>Le même écran de vérification que l'analyse d'annonce</h2>
 * Les photos sont lues par le même moteur, et rendues de la même façon :
 * une série par groupe, les tomes en pastilles, l'édition choisie une fois
 * par série. Ce qui change, c'est la question posée : sur une annonce, « que
 * contient ce lot ? » ; sur son étagère, « qu'est-ce qui manque encore à ma
 * collection ? ». D'où les tomes **déjà possédés**, cochés et inertes, et la
 * **fiche proposée** pour une série encore inconnue du catalogue.
 *
 * <h2>Rien n'est écrit avant le geste - et le geste vient en deux temps</h2>
 * La lecture ne crée rien. « Vérifier l'ajout de N tomes » passe à une
 * relecture qui montre, série par série, ce qui partirait ; c'est là que
 * « Ajouter N tomes à ma collection » envoie exactement ce qui est coché -
 * titre, numéro, édition, fiche gardée ou non - et le serveur écrit en une
 * transaction, en refusant de créer un second exemplaire d'un tome encore
 * possédé. Demandé après le premier essai sur une vraie étagère : tout
 * pré-coché, un seul clic écrivait 33 tomes.
 *
 * <h2>Les photos quittent la machine</h2>
 * Le sous-titre le dit avant le choix des fichiers, et rien ne part sans ce
 * choix : c'est le consentement, pas un drapeau à part.
 */

/** « Je ne sais pas » : le tome est ajouté sans édition. */
const SANS_EDITION = ''

interface Correction {
  coche?: boolean
  decoche?: boolean
  /** Le numéro saisi quand la photo ne le donnait pas. */
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

/** Une série telle que la relecture la montre : ce qui partirait, et rien d'autre. */
interface SerieARelire {
  groupe: Groupe
  numeros: number[]
}

function pluriel(n: number, un: string, plusieurs: string): string {
  return n > 1 ? plusieurs : un
}

export function ImportPhotoPage() {
  const queryClient = useQueryClient()
  const champFichiers = useRef<HTMLInputElement | null>(null)
  const [resultat, setResultat] = useState<ShelfAnalysisDto | null>(null)
  const [refusees, setRefusees] = useState<string | null>(null)
  /** Corrections indexées par identité de candidat - jamais par position. */
  const [corrections, setCorrections] = useState<Record<string, Correction>>({})
  /** L'édition choisie par série ; absente = pas encore choisie, '' = sans édition. */
  const [editions, setEditions] = useState<Record<string, string>>({})
  /** La fiche proposée, gardée ou non - explicitement ; sans choix, la règle par défaut s'applique (voir ficheGardee). */
  const [fichesChoisies, setFichesChoisies] = useState<Record<string, boolean>>({})
  const [groupesRetires, setGroupesRetires] = useState<Record<string, boolean>>({})
  /**
   * Deux temps avant d'écrire : vérifier (cocher, corriger, choisir), puis
   * relire noir sur blanc ce qui partirait. Le bouton du premier écran ne
   * fait que passer au second ; seul celui de la relecture écrit.
   */
  const [etape, setEtape] = useState<'verification' | 'relecture'>('verification')

  const lecture = useMutation({
    mutationFn: analyserLEtagere,
    onSuccess: (reponse) => {
      setResultat(reponse)
      setCorrections({})
      setEditions({})
      setFichesChoisies({})
      setGroupesRetires({})
      setEtape('verification')
    },
  })

  const importation = useMutation({
    mutationFn: importerDepuisLEtagere,
    onSuccess: () => invaliderApresPossession(queryClient),
  })

  const choisirPhotos = (liste: FileList | null) => {
    setRefusees(null)
    if (!liste || liste.length === 0) return
    // Copié AVANT de vider le champ : la FileList est vivante, la vider
    // viderait aussi ce qu'on tient.
    const fichiers = Array.from(liste)
    if (champFichiers.current) champFichiers.current.value = ''

    void preparerLesPhotos(fichiers).then(({ retenues, message }) => {
      setRefusees(message)
      if (retenues.length > 0) {
        // La lecture précédente s'efface tout de suite : la laisser à l'écran
        // pendant la nouvelle ferait relire des tomes d'une autre photo, ou
        // d'avant l'import - « déjà possédé » y serait faux.
        setResultat(null)
        importation.reset()
        lecture.mutate(retenues)
      }
    })
  }

  // ----------------------------------------------------------- Les groupes

  const lignes: Ligne[] = (resultat?.items ?? []).map((entree, index) => ({
    entree,
    // L'index ne sert qu'à séparer deux « tome non lu » de la même série :
    // sans lui, ils partageraient une identité, donc un même numéro saisi.
    cle: `${identite(entree.item)}#${index}`,
  }))

  /**
   * Une série par groupe. L'édition **lue** entre dans la clé : si les photos
   * distinguent « Perfect » et « Standard », ce sont deux groupes - les fondre
   * choisirait à la place de l'utilisateur.
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
    // Pré-coché : ce que le moteur juge sûr (titre ET numéro nets), série
    // connue OU nouvelle - sur une étagère, une série nouvelle est précisément
    // ce qu'on vient importer, là où un lot d'annonce ne pré-coche que le
    // catalogue. Jamais sans numéro : rien à ajouter tant qu'il n'est pas saisi.
    const item = ligne.entree.item
    return item.preselected || (item.catalogStatus === 'NOT_IN_CATALOG' && item.confidence === 'HIGH')
  }

  function estImportable(ligne: Ligne): boolean {
    return !ligne.entree.alreadyOwned && estCoche(ligne) && numeroDe(ligne) !== null
  }

  /**
   * L'édition retenue pour une série. Connue du catalogue : la sienne. À
   * confirmer : rien tant que l'utilisateur n'a pas choisi - une seule édition
   * connue n'est pas une raison de la lui attribuer. Série nouvelle : ce que
   * la photo disait, s'il y avait quelque chose.
   */
  function editionDe(groupe: Groupe): string {
    const choisie = editions[groupe.cle]
    if (choisie !== undefined) return choisie
    if (groupe.catalogStatus === 'EDITION_TO_CONFIRM') return SANS_EDITION
    return groupe.editionLue ?? SANS_EDITION
  }

  /**
   * La fiche qui partira avec la série. Retrouvée par son titre : gardée
   * d'office. Simple premier résultat de recherche (titre français lu, fiche
   * en romaji) : montrée comme une piste, gardée seulement si l'utilisateur le
   * dit - une fiche fausse importée avec assurance coûte plus qu'une série
   * créée avec son seul titre.
   */
  function ficheGardee(groupe: Groupe): FicheProposeeDto | null {
    if (groupe.catalogStatus !== 'NOT_IN_CATALOG' || !groupe.proposal) return null
    const gardee = fichesChoisies[groupe.cle] ?? groupe.proposalByTitle
    return gardee ? groupe.proposal : null
  }

  /** Le titre envoyé : celui de la fiche gardée, sinon celui du catalogue ou de la lecture. */
  function titreDe(groupe: Groupe): string {
    return ficheGardee(groupe)?.title ?? groupe.titre
  }

  function corriger(cle: string, patch: Correction) {
    setCorrections((prev) => ({ ...prev, [cle]: { ...prev[cle], ...patch } }))
  }

  /** Tout cocher ou tout décocher dans une série - les tomes possédés ne bougent pas. */
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
  /** Ce que la relecture affiche : par série, les numéros qui partiraient. */
  const relecture: SerieARelire[] = groupes
    .map((groupe) => ({
      groupe,
      numeros: groupe.lignes.filter(estImportable).map((ligne) => numeroDe(ligne) as number),
    }))
    .filter((serie) => serie.numeros.length > 0)
  const dejaPossedes = lignes.filter((ligne) => ligne.entree.alreadyOwned).length
  const enCours = lecture.isPending || importation.isPending

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

            {/* Pas encore l'ajout : ce bouton passe à la relecture, où ce
                qui partirait s'affiche noir sur blanc. L'écriture vient
                de là-bas, et de là-bas seulement. */}
            {lignes.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEtape('relecture')}
                  disabled={aImporter.length === 0 || enCours}
                  className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk disabled:opacity-40"
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
  /** Ce que le lecteur a vu pour ce tome (« Chiffre 62 sur la tranche ») - au survol, pour vérifier à la main. */
  const indice = (ligne: Ligne) => ligne.entree.item.evidence.join(' · ') || undefined

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <TexteCoupe texte={groupe.titre} className="truncate text-sm font-medium text-textPrimary" />
          <span className="flex flex-wrap items-center gap-x-2 text-xs">
            {/* La provenance parle de la donnée (« photos »), jamais du fournisseur d'IA. */}
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

      {/* La fiche que le Catalogue créerait : montrée AVANT l'import, avec sa
          jaquette, et refusable - une lecture de tranche peut se tromper de
          série, et la fiche fausse aurait alors l'aplomb d'une vraie. */}
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

      {/* Les tomes en pastilles : quatorze tomes tiennent sur deux lignes. */}
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

        {/* Pour qui préfère partir de rien et cocher à la main, tome par tome. */}
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

      {/* Une seule fois pour la série : l'édition n'est pas une propriété du tome. */}
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
          {/* Ce que la photo dit de l'édition (« Masked », « Perfect ») vaut
              d'être proposé même quand la série est déjà au catalogue : ses
              éditions connues ne la couvrent pas forcément. */}
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
 * La relecture : ce qui partirait, série par série, noir sur blanc - et le
 * seul bouton qui écrit. Rien de ce qui est affiché ici n'est encore dans la
 * collection ; « Revenir » ramène à la vérification sans rien perdre.
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
          className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk disabled:opacity-40"
        >
          {enCours ? 'Ajout…' : `Ajouter ${tomes} ${pluriel(tomes, 'tome', 'tomes')} à ma collection`}
        </button>
        <button
          type="button"
          onClick={onRevenir}
          disabled={enCours}
          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-surface px-4 text-sm font-semibold text-textPrimary shadow-token-sm disabled:opacity-40"
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
