import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { mergeEntityAttributes, removeEntityAttribute } from '../../api/entities'
import { createEdition, updateEdition } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import type { MangaEditionDto } from '../../types/purchaseAnalysis'

/**
 * Le brouillon de l'inspecteur en mode édition : les champs qu'on LIT
 * deviennent les champs qu'on SAISIT, à la même place (demande utilisateur du
 * 2026-09-05 : « rendre les champs éditables… transformer les champs lecture
 * seule et éditable », après une première version qui dupliquait le tout
 * dans une carte « Série » à côté).
 *
 * <h2>Un brouillon, un « Enregistrer »</h2>
 * Trois colonnes, deux tables en base (les attributs de l'œuvre, la fiche
 * d'édition), une seule saisie : l'utilisateur ne voit pas de frontière entre
 * « Mangaka » et « Éditeur », il n'a pas à en voir une entre deux boutons.
 * L'enregistrement écrit ce qui a changé et rien d'autre - un attribut vidé
 * est retiré (jamais une chaîne vide, voir Entity.mergeAttributes côté
 * backend), l'édition est créée ou mise à jour selon qu'elle existait.
 *
 * <h2>Ce que la source ne touchera plus</h2>
 * Chaque attribut écrit ici part avec `origine=manuelle` (défaut) : le
 * serveur le marque, et « Recharger depuis la source » ne l'écrase plus
 * (Lot 130). `saisi(cle)` rend cette marque visible à côté du champ.
 *
 * <h2>Les remarques aussi</h2>
 * « Mes remarques » est un attribut comme un autre (`note`) : il rejoint le
 * même brouillon, et perd ses propres boutons.
 */
export interface BrouillonAttributs {
  /** Ce qu'il y a dans le champ en ce moment. */
  valeur: (cle: string) => string
  saisir: (cle: string, valeur: string) => void
  /** Marqué « saisi à la main » en base : la source ne l'écrase plus. */
  saisi: (cle: string) => boolean
  /** Les clés à montrer dans la colonne ŒUVRE (tout ce qui n'est ni un rouage
   *  ni une remarque), et dans la colonne SOURCE (les rouages, dans l'ordre
   *  de la maquette puis les autres). */
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

/** Les rouages recopiés d'un fournisseur - colonne SOURCE de la maquette.
 *  Liste fermée et ORDONNÉE : c'est l'ordre de la maquette, pas celui,
 *  imprévisible, des clés du sac d'attributs. */
export const CLES_SOURCE: { cle: string; libelle: string }[] = [
  { cle: 'malId', libelle: 'malId' },
  { cle: 'titleRomaji', libelle: 'Titre romaji' },
  { cle: 'titleJapanese', libelle: 'Titre japonais' },
  { cle: 'seriesStatus', libelle: 'Statut source' },
  { cle: 'totalVolumes', libelle: 'Nb de tomes source' },
  { cle: 'endYear', libelle: 'Année de fin' },
]

/** Jaquette exclue : elle a son propre contrôle sur la fiche (voir
 * EntityDetailPage), et une URL d'image n'a rien à faire à côté du mangaka.
 * Les remarques ont leur relevé dans la colonne PERSONNEL. */
const CLES_HORS_COLONNES = [COVER_IMAGE_ATTRIBUTE_KEY, 'note']

/** Rouages plutôt qu'informations : identifiants externes et titres
 * alternatifs - la colonne SOURCE, avec CLES_SOURCE. */
const CLES_TECHNIQUES = ['malId', 'igdbId', 'bggId', 'mediaType', 'titleRomaji', 'titleEnglish', 'titleJapanese', 'seriesStatus']

/** Clés dont la valeur DOIT rester numérique quand elle est renseignée pour
 * la première fois - `totalVolumes` en tête : lue avec un `typeof === 'number'`
 * strict (voir lib/seriesInfo.totalVolumesFrom), une chaîne "48" y serait
 * silencieusement ignorée, et la progression X/Y disparaîtrait. */
// PAS les années : la fiche et l'aperçu les lisent en `typeof === 'string'`
// (« Depuis 2004 » dans le bandeau) - un nombre y disparaîtrait sans bruit.
const CLES_NUMERIQUES = ['totalVolumes', 'volumeNumber', 'averageDurationHours']

/**
 * Conserve le TYPE de la valeur existante plutôt que de tout réécrire en
 * texte : les attributs sont un sac non typé, et plusieurs lecteurs testent
 * le type avant la valeur. Tout aplatir en chaîne casserait ces lectures
 * sans le moindre message d'erreur.
 */
function valeurTypee(cle: string, texte: string, precedente: unknown): string | number {
  const veutUnNombre = typeof precedente === 'number' || (precedente === undefined && CLES_NUMERIQUES.includes(cle))
  if (!veutUnNombre) return texte
  const nombre = Number(texte)
  // Saisie non numérique sur un champ numérique : gardée telle quelle plutôt
  // que transformée en NaN - l'utilisateur voit ce qu'il a écrit.
  return Number.isFinite(nombre) ? nombre : texte
}

/** Les attributs sont un sac non typé : un même champ peut arriver en nombre
 * d'un fournisseur et en chaîne d'un autre. Tout est ramené à du texte. */
export function texteDe(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  if (typeof valeur === 'string') return valeur.trim()
  if (typeof valeur === 'number' || typeof valeur === 'boolean') return String(valeur)
  return ''
}

/** Libellés des clés réellement produites par les fournisseurs et par les
 * types livrés. Une clé inconnue (champ personnalisé créé par l'utilisateur)
 * est affichée telle quelle, juste rendue lisible. */
const LIBELLES: Record<string, string> = {
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
  malId: 'malId',
  igdbId: 'igdbId',
  bggId: 'bggId',
}

export function libelleDe(cle: string): string {
  if (LIBELLES[cle]) return LIBELLES[cle]
  const espace = cle.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
  return espace.charAt(0).toUpperCase() + espace.slice(1)
}

const AUCUNE: string[] = []

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
  /** Les rouages qu'on peut compléter même absents - les clés de la colonne
   *  SOURCE pour un manga, rien pour un jeu de société : un malId n'a pas de
   *  sens ailleurs que chez une œuvre suivie par une base de mangas. */
  clesSourceProposees?: string[]
  /** L'édition active et sa fiche de référence (null tant qu'aucune n'a été
   *  renseignée), ou null pour une œuvre sans édition nommée. */
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

  // Les champs proposés sont l'union des champs personnalisés DÉCLARÉS par
  // le type (le vocabulaire voulu, même quand la valeur est encore vide) et
  // des attributs réellement présents (ce que l'API a rempli). Aucune clé
  // libre n'est créée ici : inventer un champ, c'est modifier le TYPE.
  const { cles, clesOeuvre, clesSource } = useMemo(() => {
    const toutes = [...new Set([...customFieldKeys, ...clesSourceProposees, ...Object.keys(attributes)])].filter(
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

  // Le brouillon repart de ce qui est en base à chaque fois que la base
  // change : ouverture, enregistrement, rechargement depuis la source.
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
      // Deux opérations distinctes : compléter/corriger d'un côté, retirer de
      // l'autre. Un champ vidé doit disparaître, pas devenir une chaîne vide
      // qui ressemblerait ensuite à une donnée renseignée.
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
        // Préfixe SANS `volumes` (dernier élément de la clé, variable selon
        // ce qui est possédé), voir queryKeys.purchaseAnalysis.completeness.
        queryClient.invalidateQueries({ queryKey: ['purchaseAnalysis', 'completeness', entityTitle, edition.nom] })
        // Et la PROGRESSION : le nombre de tomes d'une édition est ce qui
        // rend « X/Y » possible, et il vient du serveur (insights/progress).
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
    /** Une promesse : « Enregistrer et terminer » attend qu'elle tienne
     *  avant de fermer le mode (voir EntityDetailPage). */
    enregistrer: () => enregistrement.mutateAsync(),
    annuler: reinitialiser,
  }
}
