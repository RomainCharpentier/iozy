import { RELEASE_DATE_ATTRIBUTE_KEY } from '@/common/lib/releaseDate'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mergeEntityAttributes, removeEntityAttribute } from '@/common/api/entities'
import { createEdition, updateEdition } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '@/common/lib/coverImage'
import type { MangaEditionDto } from '@/common/types/purchaseAnalysis'

/**
 * The inspector draft in edit mode: the fields one READS
 * become the fields one ENTERS, in the same place (user request of
 * 2026-09-05: "rendre les champs éditables… transformer les champs lecture
 * seule et éditable", after a first version that duplicated everything
 * in a "Série" card next to it).
 *
 * <h2>One draft, one "Enregistrer"</h2>
 * Three columns, two tables in the database (the attributes of the work, the edition
 * sheet), a single input: the user sees no boundary between
 * "Mangaka" and "Éditeur", and does not need to see one between two buttons.
 * Saving writes what changed and nothing else - an emptied attribute
 * is removed (never an empty string, see Entity.mergeAttributes on the
 * backend side), the edition is created or updated depending on whether it existed.
 *
 * <h2>What the source will no longer touch</h2>
 * Each attribute written here leaves with `origine=manuelle` (default): the
 * server marks it, and "Recharger depuis la source" no longer overwrites it
 * (Batch 130). `saisi(cle)` makes this mark visible next to the field.
 *
 * <h2>The remarks too</h2>
 * "Mes remarques" is an attribute like any other (`note`): it joins the
 * same draft, and loses its own buttons.
 */
export interface BrouillonAttributs {
  /** What is in the field right now. */
  valeur: (cle: string) => string
  saisir: (cle: string, valeur: string) => void
  /** Marked "saisi à la main" in the database: the source no longer overwrites it. */
  saisi: (cle: string) => boolean
  /** The keys to show in the WORK column (everything that is neither an internal
   *  nor a remark), and in the SOURCE column (the internals, in the order
   *  of the mockup then the others). */
  clesOeuvre: string[]
  clesSource: string[]
}

export interface BrouillonEdition {
  nom: string
  totalVolumes: string
  publisher: string
  outOfPrint: boolean
  betterEditionAnnounced: boolean
  betterEditionNote: string
  modifier: (changement: Partial<Omit<BrouillonEdition, 'nom' | 'modifier'>>) => void
}

/** The internals copied from a provider - SOURCE column of the mockup.
 *  Closed and ORDERED list: it is the order of the mockup, not the unpredictable
 *  one of the keys of the attribute bag. */
export const CLES_SOURCE: { cle: string; libelle: string }[] = [
  { cle: 'malId', libelle: 'Identifiant MyAnimeList' },
  { cle: 'titleRomaji', libelle: 'Titre romaji' },
  { cle: 'titleJapanese', libelle: 'Titre japonais' },
  { cle: 'seriesStatus', libelle: 'Statut source' },
  { cle: 'totalVolumes', libelle: 'Nb de tomes source' },
  { cle: 'endYear', libelle: 'Année de fin' },
]

/** Cover excluded: it has its own control on the detail page (see
 * EntityDetailPage), and an image URL has no business next to the mangaka.
 * The remarks have their own readout in the PERSONAL column. */
const CLES_HORS_COLONNES = [COVER_IMAGE_ATTRIBUTE_KEY, 'note']

/** Internals rather than information: external ids and alternative
 * titles - the SOURCE column, with CLES_SOURCE. */
const CLES_TECHNIQUES = ['malId', 'igdbId', 'bggId', 'mediaType', 'titleRomaji', 'titleEnglish', 'titleJapanese', 'seriesStatus']

/** Keys whose value MUST stay numeric when it is filled in for
 * the first time - `totalVolumes` first: read with a strict `typeof === 'number'`
 * (see lib/seriesInfo.totalVolumesFrom), a string "48" would be
 * silently ignored there, and the X/Y progress would disappear. */
// NOT the years: the detail page and the preview read them with `typeof === 'string'`
// ("Depuis 2004" in the banner) - a number would disappear there without a sound.
const CLES_NUMERIQUES = ['totalVolumes', 'volumeNumber', 'averageDurationHours']

/**
 * Keeps the TYPE of the existing value rather than rewriting everything as
 * text: the attributes are an untyped bag, and several readers test
 * the type before the value. Flattening everything into a string would break these readings
 * without any error message.
 */
function valeurTypee(cle: string, texte: string, precedente: unknown): string | number {
  const veutUnNombre = typeof precedente === 'number' || (precedente === undefined && CLES_NUMERIQUES.includes(cle))
  if (!veutUnNombre) return texte
  const nombre = Number(texte)
  // Non-numeric input on a numeric field: kept as is rather than
  // turned into NaN - the user sees what they wrote.
  return Number.isFinite(nombre) ? nombre : texte
}

/** The attributes are an untyped bag: the same field can arrive as a number
 * from one provider and as a string from another. Everything is brought back to text. */
export function texteDe(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  if (typeof valeur === 'string') return valeur.trim()
  if (typeof valeur === 'number' || typeof valeur === 'boolean') return String(valeur)
  return ''
}

/** Labels of the keys really produced by the providers and by the
 * shipped types. An unknown key (custom field created by the user)
 * is shown as is, just made readable. */
const LIBELLES: Record<string, string> = {
  releaseDate: 'Date de sortie',
  mangaka: 'Mangaka',
  author: 'Auteur',
  publisher: 'Éditeur',
  platform: 'Plateforme',
  studio: 'Studio',
  developer: 'Studio',
  seriesStatus: 'Statut source',
  totalVolumes: 'Nb de tomes source',
  volumeNumber: 'Numéro de tome',
  averageDurationHours: 'Durée moyenne (h)',
  startYear: 'Année de début',
  endYear: 'Année de fin',
  mediaType: 'Type de média',
  titleEnglish: 'Titre anglais',
  titleRomaji: 'Titre romaji',
  titleJapanese: 'Titre japonais',
  malId: 'Identifiant MyAnimeList',
  igdbId: 'Identifiant IGDB',
  bggId: 'Identifiant BGG',
}

export function libelleDe(cle: string): string {
  if (LIBELLES[cle]) return LIBELLES[cle]
  const espace = cle.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
  return espace.charAt(0).toUpperCase() + espace.slice(1)
}

const AUCUNE: string[] = []

/** What any work can fill in, whatever its type: its release
 *  date, which puts the categories without a source on the release calendar
 *  (batch 146). Offered even when absent, like the internals of a manga. */
const CLES_OEUVRE_PROPOSEES = [RELEASE_DATE_ATTRIBUTE_KEY]

export function useBrouillonInspecteur({
  entityId,
  entityTitle,
  attributes,
  champsSaisis,
  customFieldKeys,
  clesSourceProposees = AUCUNE,
  edition,
}: {
  entityId: string
  entityTitle: string
  attributes: Record<string, unknown>
  champsSaisis: string[]
  customFieldKeys: string[]
  /** The internals that can be filled in even when absent - the keys of the
   *  SOURCE column for a manga, nothing for a board game: a malId makes no
   *  sense anywhere but on a work followed by a manga database. */
  clesSourceProposees?: string[]
  /** The active edition and its reference sheet (null as long as none has been
   *  filled in), or null for a work without a named edition. */
  edition: { nom: string; info: MangaEditionDto | null } | null
}) {
  const queryClient = useQueryClient()
  const [attributs, setAttributs] = useState<Record<string, string>>({})
  const [brouillonEdition, setBrouillonEdition] = useState({
    totalVolumes: '',
    publisher: '',
    outOfPrint: false,
    betterEditionAnnounced: false,
    betterEditionNote: '',
  })

  // The offered fields are the union of the custom fields DECLARED by
  // the type (the intended vocabulary, even when the value is still empty) and
  // of the attributes really present (what the API filled in). No free
  // key is created here: inventing a field means changing the TYPE.
  const { cles, clesOeuvre, clesSource } = useMemo(() => {
    const toutes = [...new Set([...customFieldKeys, ...CLES_OEUVRE_PROPOSEES, ...clesSourceProposees, ...Object.keys(attributes)])].filter(
      (cle) => !CLES_HORS_COLONNES.includes(cle),
    )
    const ordreSource = CLES_SOURCE.map((c) => c.cle).filter((cle) => toutes.includes(cle))
    const source = [
      ...ordreSource,
      ...toutes.filter((cle) => CLES_TECHNIQUES.includes(cle) && !ordreSource.includes(cle)),
    ]
    const oeuvre = toutes.filter((cle) => !source.includes(cle))
    return { cles: [...new Set([...oeuvre, ...source, 'note'])], clesOeuvre: oeuvre, clesSource: source }
  }, [attributes, customFieldKeys, clesSourceProposees])

  const info = edition?.info ?? null

  // The draft restarts from what is in the database each time the database
  // changes: opening, saving, reloading from the source.
  function reinitialiser() {
    const initial: Record<string, string> = {}
    for (const cle of cles) initial[cle] = texteDe(attributes[cle])
    setAttributs(initial)
    setBrouillonEdition({
      totalVolumes: info?.totalVolumes != null ? String(info.totalVolumes) : '',
      publisher: info?.publisher ?? '',
      outOfPrint: info?.outOfPrint ?? false,
      betterEditionAnnounced: info?.betterEditionAnnounced ?? false,
      betterEditionNote: info?.betterEditionNote ?? '',
    })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reinitialiser, [
    attributes,
    cles,
    edition?.nom,
    info?.id,
    info?.totalVolumes,
    info?.publisher,
    info?.outOfPrint,
    info?.betterEditionAnnounced,
    info?.betterEditionNote,
  ])

  const attributsModifies = cles.some((cle) => (attributs[cle] ?? '').trim() !== texteDe(attributes[cle]))
  const editionModifiee =
    edition !== null &&
    (brouillonEdition.totalVolumes !== (info?.totalVolumes != null ? String(info.totalVolumes) : '') ||
      brouillonEdition.publisher !== (info?.publisher ?? '') ||
      brouillonEdition.outOfPrint !== (info?.outOfPrint ?? false) ||
      brouillonEdition.betterEditionAnnounced !== (info?.betterEditionAnnounced ?? false) ||
      brouillonEdition.betterEditionNote !== (info?.betterEditionNote ?? ''))

  const enregistrement = useMutation({
    mutationFn: async () => {
      // Two separate operations: complete/fix on one side, remove on
      // the other. An emptied field must disappear, not become an empty string
      // that would then look like a filled-in value.
      const ecritures: Record<string, string | number> = {}
      const retraits: string[] = []
      for (const cle of cles) {
        const suivante = (attributs[cle] ?? '').trim()
        if (suivante === texteDe(attributes[cle])) continue
        if (suivante === '') {
          if (cle in attributes) retraits.push(cle)
        } else {
          ecritures[cle] = valeurTypee(cle, suivante, attributes[cle])
        }
      }
      if (Object.keys(ecritures).length > 0) await mergeEntityAttributes(entityId, ecritures)
      for (const cle of retraits) await removeEntityAttribute(entityId, cle)

      if (edition && editionModifiee) {
        const totalVolumes = brouillonEdition.totalVolumes.trim() ? Number(brouillonEdition.totalVolumes) : undefined
        const publisher = brouillonEdition.publisher.trim() || undefined
        const betterEditionNote = brouillonEdition.betterEditionNote.trim() || undefined
        const commun = {
          totalVolumes,
          publisher,
          outOfPrint: brouillonEdition.outOfPrint,
          betterEditionAnnounced: brouillonEdition.betterEditionAnnounced,
          betterEditionNote,
        }
        const enregistree = info
          ? await updateEdition(info.id, commun)
          : await createEdition({
              entityId,
              seriesTitle: entityTitle,
              editionName: edition.nom,
              editionTier: 'STANDARD',
              ...commun,
            })
        queryClient.setQueryData(queryKeys.purchaseAnalysis.edition(entityTitle, edition.nom), enregistree)
        // Prefix WITHOUT `volumes` (last element of the key, varying with
        // what is owned), see queryKeys.purchaseAnalysis.completeness.
        queryClient.invalidateQueries({ queryKey: ['purchaseAnalysis', 'completeness', entityTitle, edition.nom] })
        // And PROGRESS: the number of volumes of an edition is what
        // makes "X/Y" possible, and it comes from the server (insights/progress).
        queryClient.invalidateQueries({ queryKey: queryKeys.insights.progress })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })

  const brouillon: BrouillonAttributs = {
    valeur: (cle) => attributs[cle] ?? '',
    saisir: (cle, valeur) => setAttributs((prev) => ({ ...prev, [cle]: valeur })),
    saisi: (cle) => champsSaisis.includes(cle),
    clesOeuvre,
    clesSource,
  }

  const brouillonDEdition: BrouillonEdition | null = edition
    ? {
        nom: edition.nom,
        ...brouillonEdition,
        modifier: (changement) => setBrouillonEdition((prev) => ({ ...prev, ...changement })),
      }
    : null

  return {
    attributs: brouillon,
    edition: brouillonDEdition,
    modifie: attributsModifies || editionModifiee,
    enCours: enregistrement.isPending,
    erreur: enregistrement.isError ? enregistrement.error.message : null,
    /** A promise: "Enregistrer et terminer" waits for it to hold
     *  before closing the mode (see EntityDetailPage). */
    enregistrer: () => enregistrement.mutateAsync(),
    annuler: reinitialiser,
  }
}
