import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { mergeEntityAttributes, removeEntityAttribute } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * "L'œuvre" - TOUT ce qui décrit la chose elle-même, par opposition au reste
 * de la fiche, qui décrit ce que l'utilisateur en POSSÈDE (progression, mes
 * tomes, mes classements, l'état de chaque exemplaire).
 * <p>
 * Un seul bloc, deux sous-groupes explicites (retour utilisateur du
 * 2026-08-20 : "compliqué de faire la différence entre notre possession et
 * les metadatas du truc") : la fiche affichait deux blocs de métadonnées sans
 * dire d'où ils venaient - "À propos" (données de l'ÉDITION, source
 * MangaEdition, qui vivait dans TomesGridSection) et "Informations" (données
 * de la SÉRIE, source entity.attributes). Le nombre de tomes y était même
 * répété une troisième fois, le hero l'affichant déjà deux fois.
 * <p>
 * Principe posé par l'utilisateur (2026-08-20) : ce qu'on copie depuis une
 * API externe devient une donnée à SOI, donc corrigeable ; et un type sans
 * API doit permettre de tout saisir à la main. Jusqu'ici seuls le titre, la
 * jaquette et l'édition étaient rattrapables - le reste (mangaka, éditeur,
 * plateforme, studio, champs personnalisés du type...) restait figé tel que
 * le fournisseur l'avait renvoyé, et un type personnalisé n'affichait
 * absolument rien.
 * <p>
 * Les champs proposés sont l'union des champs personnalisés DÉCLARÉS par le
 * type (voir EntityType.customFieldKeys - le vocabulaire voulu, même quand
 * la valeur est encore vide) et des attributs réellement présents sur
 * l'œuvre (ce que l'API a rempli). Aucune clé libre n'est créée ici :
 * inventer un champ, c'est modifier le TYPE, pas une de ses œuvres.
 */
export function EntityInfoSection({
  entityId,
  attributes,
  customFieldKeys,
  edition,
}: {
  entityId: string
  attributes: Record<string, unknown>
  customFieldKeys: string[]
  /** Édition affichée, quand il y en a une (mangas). Volontairement SANS le
   * nombre de tomes : le hero l'annonce déjà deux fois ("1 / 6 tomes
   * possédés" puis "Black Édition · 6 tomes"). Et sans bouton de correction :
   * il existe déjà, accroché au nom de l'édition dans le hero (voir
   * EditionCorrectionSection) - deux entrées vers le même formulaire seraient
   * exactement le genre de doublon qu'on retire ici. */
  edition?: {
    name: string
    publisher: string | null
    outOfPrint: boolean
    betterEditionAnnounced: boolean
    betterEditionNote: string | null
    /** Statut lisible de la série (En cours / Terminée), null si inconnu. */
    ongoing: boolean | null
  } | null
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const { descriptive, technical, fields } = useMemo(() => {
    const keys = [...new Set([...customFieldKeys, ...Object.keys(attributes)])].filter(
      (key) => !HIDDEN_KEYS.includes(key),
    )
    // Les identifiants externes et les titres alternatifs restent modifiables
    // (ils ont été copiés en base, ils appartiennent donc à l'utilisateur),
    // mais repliés : ce sont des rouages - un malId erroné casse la détection
    // des suites/spin-offs (voir RelatedSeriesService), un titre romaji change
    // ce qui s'affiche partout (voir lib/titleLanguage). Les mettre au même
    // rang que "Mangaka" ferait de la plomberie le visage de la fiche.
    const descriptiveKeys = keys.filter((key) => !TECHNICAL_KEYS.includes(key))
    const technicalKeys = keys.filter((key) => TECHNICAL_KEYS.includes(key))
    return { descriptive: descriptiveKeys, technical: technicalKeys, fields: [...descriptiveKeys, ...technicalKeys] }
  }, [attributes, customFieldKeys])

  const mutation = useMutation({
    mutationFn: async () => {
      // Deux opérations distinctes : compléter/corriger d'un côté, retirer de
      // l'autre. Un champ vidé doit disparaître, pas devenir une chaîne vide
      // qui ressemblerait ensuite à une donnée renseignée (voir
      // Entity.mergeAttributes côté backend, dont la javadoc l'interdit).
      const updates: Record<string, string | number> = {}
      const removals: string[] = []
      for (const key of fields) {
        const next = (draft[key] ?? '').trim()
        const current = displayValue(attributes[key])
        if (next === current) continue
        if (next === '') {
          if (key in attributes) removals.push(key)
        } else {
          updates[key] = typedValue(key, next, attributes[key])
        }
      }
      if (Object.keys(updates).length > 0) await mergeEntityAttributes(entityId, updates)
      for (const key of removals) await removeEntityAttribute(entityId, key)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      setEditing(false)
    },
  })

  function startEditing() {
    const initial: Record<string, string> = {}
    for (const key of fields) initial[key] = displayValue(attributes[key])
    setDraft(initial)
    setEditing(true)
  }

  const filled = descriptive.filter((key) => displayValue(attributes[key]) !== '')
  const filledTechnical = technical.filter((key) => displayValue(attributes[key]) !== '')

  // "Terminée" plutôt que "finished" : la valeur brute reste modifiable parmi
  // les champs techniques, mais ce qu'on LIT ici est la forme humaine (voir
  // lib/seriesInfo.isSeriesOngoing, qui ne comprend que le vocabulaire des
  // fournisseurs).
  const seriesStatusRow = edition?.ongoing == null ? null : edition.ongoing ? 'En cours' : 'Terminée'

  const editionRows: Array<[string, string]> = []
  // "Éditeur de cette édition" et non "Éditeur" : l'attribut publisher de la
  // SÉRIE existe aussi (champ personnalisé du type Manga) et ne veut pas dire
  // la même chose - pour un candidat Jikan c'est la revue de prépublication
  // japonaise, pas l'éditeur français, confusion déjà corrigée ailleurs (voir
  // pickCandidate). Deux lignes "Éditeur" côte à côte avec deux valeurs
  // différentes seraient exactement l'ambiguïté qu'on retire ici.
  if (edition?.publisher) editionRows.push(['Éditeur de cette édition', edition.publisher])
  if (edition?.outOfPrint) editionRows.push(['Disponibilité', 'Édition épuisée'])
  if (edition?.betterEditionAnnounced) {
    editionRows.push(['À venir', edition.betterEditionNote || 'Meilleure édition annoncée'])
  }

  // Rien à montrer ET rien à remplir : le bloc disparaît entièrement plutôt
  // que d'afficher une section vide.
  if (fields.length === 0 && editionRows.length === 0 && edition?.ongoing == null) return null

  return (
    <section className="flex flex-col gap-3 border-t border-surface pt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-textPrimary">L'œuvre</h2>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accentText"
          >
            <Pencil size={14} />
            {filled.length > 0 ? 'Modifier' : 'Renseigner'}
          </button>
        )}
      </div>

      {mutation.isError && <ErrorBanner message={mutation.error.message} />}

      {editing ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(showTechnical ? fields : descriptive).map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-textDim" htmlFor={`attr-${key}`}>
                  {labelFor(key)}
                </label>
                <input
                  id={`attr-${key}`}
                  value={draft[key] ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            ))}
          </div>
          {technical.length > 0 && !showTechnical && (
            <button
              type="button"
              onClick={() => setShowTechnical(true)}
              className="w-fit text-xs font-semibold text-accentText"
            >
              Afficher les champs techniques ({technical.length})
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-2 py-2 text-sm text-textDim">
              Annuler
            </button>
            <span className="text-xs text-textDim">Un champ vidé est retiré.</span>
          </div>
        </>
      ) : (
        <>
          {/* Sous-groupe SÉRIE : ce qui reste vrai quelle que soit l'édition
              qu'on possède (auteur, année, statut de publication). */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-textDim uppercase">Série</h3>
            {filled.length > 0 || filledTechnical.length > 0 || seriesStatusRow !== null ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,max-content))] gap-x-10 gap-y-3">
                {seriesStatusRow && (
                  <dl className="flex flex-col gap-0.5 text-sm">
                    <dt className="text-textDim">Statut</dt>
                    <dd className="text-textPrimary">{seriesStatusRow}</dd>
                  </dl>
                )}
                {(showTechnical ? [...filled, ...filledTechnical] : filled).map((key) => (
                  <dl key={key} className="flex flex-col gap-0.5 text-sm">
                    <dt className="text-textDim">{labelFor(key)}</dt>
                    <dd className="text-textPrimary">{displayValue(attributes[key])}</dd>
                  </dl>
                ))}
              </div>
            ) : (
              <p className="text-sm text-textDim">Aucune information renseignée pour l'instant.</p>
            )}
            {filledTechnical.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTechnical((v) => !v)}
                className="w-fit text-xs font-semibold text-accentText"
              >
                {showTechnical ? 'Masquer les champs techniques' : `Champs techniques (${filledTechnical.length})`}
              </button>
            )}
          </div>

          {/* Sous-groupe ÉDITION : ce qui ne vaut QUE pour l'édition affichée
              (l'éditeur français, son épuisement...). Nommé avec l'édition
              elle-même, sinon "Éditeur : Kana" ressemble à une propriété de la
              série - alors qu'une autre édition a un autre éditeur. */}
          {editionRows.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <h3 className="text-xs font-semibold tracking-wide text-textDim uppercase">
                Édition « {edition?.name} »
              </h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,max-content))] gap-x-10 gap-y-3">
                {editionRows.map(([label, value]) => (
                  <dl key={label} className="flex flex-col gap-0.5 text-sm">
                    <dt className="text-textDim">{label}</dt>
                    <dd className="text-textPrimary">{value}</dd>
                  </dl>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Jaquette exclue : elle a déjà son propre contrôle sur la fiche (voir
 * EntityDetailPage), et une URL d'image n'a rien à faire dans un formulaire
 * de texte à côté du mangaka. */
const HIDDEN_KEYS = [COVER_IMAGE_ATTRIBUTE_KEY]

/** Rouages plutôt qu'informations : identifiants externes et titres
 * alternatifs. Modifiables comme le reste, mais repliés par défaut - voir le
 * commentaire dans le composant. */
const TECHNICAL_KEYS = [
  'malId',
  'igdbId',
  'bggId',
  'mediaType',
  'titleRomaji',
  'titleEnglish',
  'titleJapanese',
  // seriesStatus n'est PAS du texte libre : seuls "finished"/"publishing"/
  // "currently_publishing" sont compris (voir lib/seriesInfo.isSeriesOngoing,
  // deux vocabulaires de sources différentes). Y écrire "Terminée" ferait
  // silencieusement disparaître la ligne "Statut" de "À propos" - replié
  // comme les autres rouages plutôt que présenté comme une info à saisir.
  'seriesStatus',
]

/** Clés dont la valeur DOIT rester numérique quand elle est renseignée pour
 * la première fois - `totalVolumes` en tête : lue avec un `typeof === 'number'`
 * strict (voir lib/seriesInfo.totalVolumesFrom), une chaîne "48" y serait
 * silencieusement ignorée, et la progression X/Y disparaîtrait. */
const NUMERIC_KEYS = ['totalVolumes', 'volumeNumber', 'averageDurationHours']

/**
 * Conserve le TYPE de la valeur existante plutôt que de tout réécrire en
 * texte : les attributs sont un sac non typé, et plusieurs lecteurs testent
 * le type avant la valeur (`typeof === 'number'` pour totalVolumes,
 * `typeof === 'string'` pour malId côté AddDraftPage). Tout aplatir en
 * chaîne casserait ces lectures sans le moindre message d'erreur.
 */
function typedValue(key: string, next: string, previous: unknown): string | number {
  const wantsNumber = typeof previous === 'number' || (previous === undefined && NUMERIC_KEYS.includes(key))
  if (!wantsNumber) return next
  const parsed = Number(next)
  // Saisie non numérique sur un champ numérique : gardée telle quelle plutôt
  // que transformée en NaN - l'utilisateur voit ce qu'il a écrit, et la
  // lecture stricte côté app ignorera simplement la valeur.
  return Number.isFinite(parsed) ? parsed : next
}

/** Libellés des clés réellement produites par les fournisseurs et par les
 * types livrés. Une clé inconnue (champ personnalisé créé par l'utilisateur)
 * est affichée telle quelle, juste rendue lisible - jamais masquée faute
 * d'être prévue ici. */
const LABELS: Record<string, string> = {
  mangaka: 'Mangaka',
  publisher: 'Éditeur',
  platform: 'Plateforme',
  studio: 'Studio',
  seriesStatus: 'Statut de la série',
  totalVolumes: 'Nombre de tomes',
  volumeNumber: 'Numéro de tome',
  averageDurationHours: 'Durée moyenne (h)',
  startYear: 'Année de début',
  mediaType: 'Type de média',
  titleEnglish: 'Titre anglais',
  titleRomaji: 'Titre romaji',
  titleJapanese: 'Titre japonais',
  malId: 'Identifiant MyAnimeList',
}

function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key]
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Les attributs sont un sac non typé (voir Entity.attributes côté backend) :
 * un même champ peut arriver en nombre d'un fournisseur et en chaîne d'un
 * autre. Tout est ramené à du texte pour l'affichage ET pour la saisie. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}
