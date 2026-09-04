import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, PenLine } from 'lucide-react'
import { mergeEntityAttributes, removeEntityAttribute } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import { ErrorBanner } from '../../components/ErrorBanner'

/**
 * "L'œuvre" - TOUT ce qui décrit la chose elle-même, par opposition au reste
 * de la fiche, qui décrit ce que l'utilisateur en POSSÈDE (progression, mes
 * tomes, mes classements, l'état de chaque exemplaire).
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
 *
 * <h2>Toujours un formulaire, et une marque par champ (Lot 130)</h2>
 * Cette carte ne vit qu'en mode édition, sous le seul « Éditer » de la page
 * (Lot 129) : elle n'a donc plus d'état « lecture » ni de bouton pour en
 * sortir - chaque champ est saisissable d'emblée, c'est ce que demande
 * l'utilisateur (« rendre chaque champ éditable pour compléter les infos en
 * base »). Et ce qu'il tape est MARQUÉ : le serveur retient les clés saisies
 * à la main (`champsSaisis`), et « Recharger depuis la source » n'écrase que
 * les autres. La marque s'affiche à côté du champ ; la retirer, c'est vider
 * le champ, la source pourra alors le remplir à nouveau.
 */
export function EntityInfoSection({
  entityId,
  attributes,
  champsSaisis,
  customFieldKeys,
}: {
  entityId: string
  attributes: Record<string, unknown>
  /** Les clés saisies à la main, que la source ne touche plus (voir
   *  EntityResponse.champsSaisis). */
  champsSaisis: string[]
  customFieldKeys: string[]
}) {
  const queryClient = useQueryClient()
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

  // Le brouillon repart de ce qui est en base à chaque fois que la base
  // change (ouverture, enregistrement, rechargement depuis la source).
  function reinitialiser() {
    const initial: Record<string, string> = {}
    for (const key of fields) initial[key] = displayValue(attributes[key])
    setDraft(initial)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reinitialiser, [attributes, fields])

  const modifie = fields.some((key) => (draft[key] ?? '').trim() !== displayValue(attributes[key]))

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
    },
  })

  // Rien à montrer ET rien à remplir : le bloc disparaît entièrement plutôt
  // que d'afficher une section vide.
  if (fields.length === 0) return null

  const champ = (key: string) => {
    const saisi = champsSaisis.includes(key)
    return (
      <div key={key} className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-xs text-textDim" htmlFor={`attr-${key}`}>
          {labelFor(key)}
          {saisi && (
            <span
              className="flex items-center gap-1 rounded-full bg-softBtn px-1.5 py-0.5 text-[10.5px] font-medium text-textDim"
              title="Saisi à la main : un rechargement depuis la source ne l'écrase pas. Vide le champ pour rendre la place à la source."
            >
              <PenLine size={10} aria-hidden="true" />
              saisi
            </span>
          )}
        </label>
        <input
          id={`attr-${key}`}
          value={draft[key] ?? ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
          className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[16.5px] font-semibold text-textPrimary">Série</h3>
        <p className="text-xs text-textDim">
          Ce que tu saisis est marqué et n’est plus écrasé par « Recharger depuis la source ». Un champ vidé est
          retiré, et la source peut le remplir à nouveau.
        </p>
      </div>

      {mutation.isError && <ErrorBanner message={mutation.error.message} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{descriptive.map(champ)}</div>

      {/* Les rouages, repliés derrière un chevron (maquette v4) : ils
          restent modifiables, mais ne sont pas le visage de la fiche. */}
      {technical.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setShowTechnical((v) => !v)}
            aria-expanded={showTechnical}
            className={`flex w-fit items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium ${
              showTechnical ? 'bg-softPress text-textPrimary' : 'bg-softBtn text-textDim'
            }`}
          >
            {showTechnical ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Champs techniques ({technical.length})
          </button>
          {showTechnical && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{technical.map(champ)}</div>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !modifie}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
        >
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button
          type="button"
          onClick={reinitialiser}
          disabled={!modifie}
          className="px-2 py-2 text-sm text-textDim disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
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
  seriesStatus: 'Statut brut',
  totalVolumes: 'Nombre de tomes (source)',
  volumeNumber: 'Numéro de tome',
  averageDurationHours: 'Durée moyenne (h)',
  startYear: 'Année de début',
  endYear: 'Année de fin',
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
