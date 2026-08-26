import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { listEntityTypes, createEntityType, updateEntityType } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { UNIVERSE_ASPECTS, UNIVERSE_ICONS, UNIVERSE_PALETTE, colorVarFor } from '../../lib/entityTypeVisuals'
import { ErrorBanner } from '../../components/ErrorBanner'
import { EnTeteSection } from '../../components/EnTeteSection'

interface EntityTypeFormPageProps {
  mode: 'create' | 'edit'
}

/** Création/édition d'un type. Les types d'expérience autorisés et les
 * champs personnalisés sont des listes libres en saisie (chaque type MVP
 * historique a la sienne, aucune liste canonique commune n'existe côté
 * backend pour proposer un multi-select) - même formulaire que côté iOS
 * (EntityTypeFormView). */
/** "Vinyles" -> "VINYLE", "Jeux de société" -> "JEUX_DE_SOCIETE" - accents
 * retirés, séparateurs en underscore, majuscules : la forme qu'ont déjà les
 * codes livrés (MANGA, VIDEO_GAME, BOARD_GAME). Reste modifiable à la main :
 * c'est une proposition, pas une contrainte. */
function codeFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    // Les ligatures ne se décomposent pas en NFD : sans cette ligne, « Œuvres »
    // donnait le code « UVRES », la lettre initiale simplement avalée.
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function EntityTypeFormPage({ mode }: EntityTypeFormPageProps) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const existing = mode === 'edit' ? entityTypesQuery.data?.find((t) => t.id === id) : undefined

  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  // Identité visuelle : des CLÉS de palette, pas une couleur libre - chaque
  // teinte de UNIVERSE_PALETTE est calibrée pour rester lisible en TEXTE dans
  // les deux thèmes, ce qu'un sélecteur libre ne peut pas garantir.
  const [colorKey, setColorKey] = useState<string | null>(null)
  const [iconKey, setIconKey] = useState<string | null>(null)
  const [aspectKey, setAspectKey] = useState<string | null>(null)
  // Le code suit le label tant que l'utilisateur n'y a pas touché : l'aide
  // sous le champ promettait "normalisé automatiquement" alors qu'il fallait
  // inventer un code technique à la main (VINYLE, BOARD_GAME...). Une fois
  // édité manuellement, il n'est plus jamais écrasé.
  const [codeEditedByHand, setCodeEditedByHand] = useState(false)
  const [allowedExperienceTypes, setAllowedExperienceTypes] = useState<string[]>([])
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([])

  useEffect(() => {
    if (existing) {
      setCode(existing.code)
      setLabel(existing.label)
      setAllowedExperienceTypes(existing.allowedExperienceTypes)
      setCustomFieldKeys(existing.customFieldKeys)
      setColorKey(existing.colorKey)
      setIconKey(existing.iconKey)
      setAspectKey(existing.aspectKey)
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? createEntityType({
            code,
            label: label.trim(),
            allowedExperienceTypes,
            customFieldKeys,
            colorKey: colorKey ?? undefined,
            iconKey: iconKey ?? undefined,
            aspectKey: aspectKey ?? undefined,
          })
        : updateEntityType(id!, {
            label: label.trim(),
            allowedExperienceTypes,
            customFieldKeys,
            colorKey: colorKey ?? undefined,
            iconKey: iconKey ?? undefined,
            aspectKey: aspectKey ?? undefined,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityTypes.all })
      navigate('/types')
    },
  })

  /**
   * Ce qui manque pour créer le type - dit, plutôt que laissé à deviner.
   *
   * Même principe que `raisonBlocage` dans PurchaseAnalysisPage, qui le
   * formule ainsi : un bouton principal grisé sans explication est un
   * cul-de-sac. Il manquait ici, et le cas y est nettement plus retors : le
   * code se DÉDUIT du label, et codeFromLabel ne garde que [A-Z0-9]. Un label
   * en japonais, en cyrillique ou fait de symboles produit donc un code vide -
   * l'écran montre alors un label bien rempli, un champ Code vide qu'on n'a
   * jamais touché, et un bouton mort. Vérifié : « 漫画 » donne exactement ça.
   */
  const raisonBlocage = !label.trim()
    ? 'Donne un label à ce type : c’est le nom que tu liras dans l’application.'
    : !code.trim()
      ? `Le code n’a pas pu être déduit de « ${label.trim()} » : il n’accepte que des lettres sans accent et des chiffres. Écris-le à la main.`
      : null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim() || !code.trim()) return
    mutation.mutate()
  }

  // Le retour anticipé est le bon choix ici - rendre le formulaire pendant le
  // chargement montrerait des champs vides qui se rempliraient sous les doigts
  // de qui a commencé à taper. Mais le titre, lui, reste : sans h1 la page perd
  // le titre de son onglet (useDocumentTitle le lit dessus) et son repère de
  // structure. Ce cas n'existe qu'en mode édition, d'où le titre en dur.
  if (mode === 'edit' && entityTypesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <EnTeteSection niveau={1} titre="Modifier le type" />
        <p className="text-textDim">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <EnTeteSection niveau={1} titre={mode === 'create' ? 'Nouveau type' : 'Modifier le type'} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-textDim" htmlFor="label">
              Label
            </label>
            <input
              id="label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                if (mode === 'create' && !codeEditedByHand) setCode(codeFromLabel(e.target.value))
              }}
              placeholder="ex : Films, Vinyles..."
              className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {mode === 'edit' ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-textDim">Code</span>
              <p className="text-sm text-textPrimary">{code}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-textDim" htmlFor="code">
                Code
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => {
                  setCodeEditedByHand(true)
                  setCode(e.target.value)
                }}
                placeholder="ex : FILM, VINYLE..."
                className="rounded-lg bg-surface2 px-3 py-2 text-sm uppercase text-textPrimary placeholder:text-textDim placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-textDim">
                Déduit du label, modifiable ici. Ne pourra plus être changé après la création.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-textDim">Couleur</span>
          <div className="flex flex-wrap gap-2">
            {UNIVERSE_PALETTE.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setColorKey(colorKey === entry.key ? null : entry.key)}
                aria-pressed={colorKey === entry.key}
                aria-label={entry.label}
                title={entry.label}
                className={`h-9 w-9 rounded-full transition-transform hover:-translate-y-0.5 ${
                  colorKey === entry.key ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''
                }`}
                style={{ background: colorVarFor(entry.key) }}
              />
            ))}
          </div>
          <p className="text-xs text-textDim">
            Rien de sélectionné = couleur par défaut. Chaque teinte reste lisible dans les deux thèmes.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-textDim">Icône</span>
          <div className="flex flex-wrap gap-2">
            {UNIVERSE_ICONS.map(({ key, label: iconLabel, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setIconKey(iconKey === key ? null : key)}
                aria-pressed={iconKey === key}
                aria-label={iconLabel}
                title={iconLabel}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  iconKey === key ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
                }`}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-textDim">Format des jaquettes</span>
          <div className="flex flex-wrap gap-3">
            {UNIVERSE_ASPECTS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setAspectKey(aspectKey === entry.key ? null : entry.key)}
                aria-pressed={aspectKey === entry.key}
                title={entry.hint}
                className="flex flex-col items-center gap-1.5"
              >
                {/* Un aperçu de la forme réelle plutôt qu'un nom seul : "3/4"
                    ne dit rien tant qu'on ne l'a pas vu à côté d'un carré. */}
                <span
                  className={`w-12 rounded-lg ${entry.className} ${
                    aspectKey === entry.key ? 'bg-accent ring-2 ring-accent ring-offset-2 ring-offset-background' : 'bg-surface2'
                  }`}
                />
                <span className={`text-xs ${aspectKey === entry.key ? 'text-textPrimary' : 'text-textDim'}`}>
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-textDim">Rien de sélectionné = portrait, le format par défaut.</p>
        </div>

        <ChipListField
          title="Types d'expérience autorisés"
          placeholder="ex : READ, PLAYED..."
          values={allowedExperienceTypes}
          onChange={setAllowedExperienceTypes}
        />

        <ChipListField
          title="Champs personnalisés"
          placeholder="ex : auteur, plateforme..."
          values={customFieldKeys}
          onChange={setCustomFieldKeys}
        />

        {mutation.isError && <ErrorBanner message={mutation.error.message} />}

        <button
          type="submit"
          disabled={!label.trim() || !code.trim() || mutation.isPending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk disabled:opacity-50"
        >
          {mutation.isPending ? 'Enregistrement...' : mode === 'create' ? 'Créer' : 'Enregistrer'}
        </button>
        {raisonBlocage && (
          <p className="text-xs text-textDim" role="status">
            {raisonBlocage}
          </p>
        )}
      </form>
    </div>
  )
}

interface ChipListFieldProps {
  title: string
  placeholder: string
  values: string[]
  onChange: (values: string[]) => void
}

function ChipListField({ title, placeholder, values, onChange }: ChipListFieldProps) {
  const [newValue, setNewValue] = useState('')
  // Identifiant stable dérivé du titre : deux ChipListField coexistent sur ce
  // formulaire, chacun doit pointer SON propre libellé.
  const labelId = `chip-field-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  function add() {
    const trimmed = newValue.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
    setNewValue('')
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Le titre de section EST le libellé du champ : sans ce lien explicite,
          un lecteur d'écran annonce "zone d'édition" sans nom (le placeholder
          ne fait pas office de libellé). */}
      <span className="text-sm text-textDim" id={labelId}>
        {title}
      </span>
      <div className="flex gap-2">
        <input
          aria-labelledby={labelId}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          type="button"
          onClick={add}
          disabled={!newValue.trim()}
          className="rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="flex items-center gap-0.5 rounded-full bg-surface py-1 pr-1 pl-3 text-sm text-textPrimary"
            >
              {value}
              {/* Le libellé de la puce est DANS le <span> parent, pas dans le
                  bouton : sans aria-label, celui-ci s'annonçait "bouton" tout
                  court. Invisible au Lot 24, qui n'a audité que /types/new -
                  un formulaire vierge, donc sans aucune puce (voir Lot 29). */}
              {/* 24x24 de zone cliquable pour une croix de 12px : en dessous,
                  la cible échoue au critère WCAG 2.5.8 (24x24 minimum) et
                  l'exception d'espacement ne s'applique pas, les puces étant
                  collées les unes aux autres. La puce compense par un padding
                  droit réduit, pour que rien ne grossisse visuellement. */}
              <button
                type="button"
                aria-label={`Retirer ${value}`}
                onClick={() => onChange(values.filter((v) => v !== value))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-surface2"
              >
                <X size={12} className="text-textDim" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
