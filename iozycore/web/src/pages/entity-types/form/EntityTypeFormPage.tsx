import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { listEntityTypes, createEntityType, updateEntityType } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import type { EntityTypeDto } from '@/common/types/api'
import { UNIVERSE_ASPECTS, UNIVERSE_ICONS, UNIVERSE_PALETTE, colorVarFor } from '@/common/lib/entityTypeVisuals'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { Squelette } from '@/common/components/Squelette'

interface EntityTypeFormPageProps {
  mode: 'create' | 'edit'
}

/** Creation/edition of a type. The allowed experience types and the
 * custom fields are free lists entered by typing (each historical
 * MVP type has its own, no common canonical list exists on the
 * backend side to offer a multi-select) - same form as on iOS
 * (EntityTypeFormView). */
/** "Vinyles" -> "VINYLE", "Jeux de société" -> "JEUX_DE_SOCIETE" - accents
 * removed, separators as underscore, uppercase: the form that the delivered
 * codes already have (MANGA, VIDEO_GAME, BOARD_GAME). Can still be edited by hand:
 * it is a suggestion, not a constraint. */
function codeFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    // Ligatures do not decompose in NFD: without this line, "Œuvres"
    // gave the code "UVRES", the initial letter simply swallowed.
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function EntityTypeFormPage({ mode }: EntityTypeFormPageProps) {
  const { id } = useParams<{ id: string }>()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const existing = mode === 'edit' ? entityTypesQuery.data?.find((t) => t.id === id) : undefined

  // The early return is the right choice here - rendering the form during
  // loading would show empty fields that would fill up under the fingers
  // of whoever started typing. But the title stays: without an h1 the page loses
  // the title of its tab (useDocumentTitle reads it from it) and its structure
  // landmark. This case only exists in edit mode, hence the hard-coded title.
  if (mode === 'edit' && entityTypesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <LienRetour parDefaut={{ to: '/types', libelle: 'Catégories de collection' }} />
        <EnTeteSection niveau={1} titre="Modifier le type" />
        <Squelette lignes={3} />
      </div>
    )
  }

  // The form mounts once the type is known, and anew for another type: its
  // fields start from the type itself, with no effect copying it into them.
  return <EntityTypeForm key={id ?? 'new'} mode={mode} id={id} existing={existing} />
}

function EntityTypeForm({ mode, id, existing }: { mode: 'create' | 'edit'; id: string | undefined; existing: EntityTypeDto | undefined }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [code, setCode] = useState(existing?.code ?? '')
  const [label, setLabel] = useState(existing?.label ?? '')
  // Visual identity: palette KEYS, not a free color - each
  // shade of UNIVERSE_PALETTE is calibrated to stay readable as TEXT in
  // both themes, which a free picker cannot guarantee.
  const [colorKey, setColorKey] = useState<string | null>(existing?.colorKey ?? null)
  const [iconKey, setIconKey] = useState<string | null>(existing?.iconKey ?? null)
  const [aspectKey, setAspectKey] = useState<string | null>(existing?.aspectKey ?? null)
  // The code follows the label as long as the user has not touched it: the help
  // under the field promised "normalisé automatiquement" while one had to
  // invent a technical code by hand (VINYLE, BOARD_GAME...). Once
  // edited manually, it is never overwritten again.
  const [codeEditedByHand, setCodeEditedByHand] = useState(false)
  const [allowedExperienceTypes, setAllowedExperienceTypes] = useState<string[]>(existing?.allowedExperienceTypes ?? [])
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>(existing?.customFieldKeys ?? [])

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
   * What is missing to create the type - said, rather than left to guess.
   *
   * Same principle as `raisonBlocage` in PurchaseAnalysisPage, which words it
   * like this: a greyed-out main button without explanation is a
   * dead end. It was missing here, and the case is clearly trickier here: the
   * code is DEDUCED from the label, and codeFromLabel only keeps [A-Z0-9]. A label
   * in Japanese, in Cyrillic or made of symbols therefore produces an empty code -
   * the screen then shows a well-filled label, an empty Code field that was
   * never touched, and a dead button. Checked: "漫画" gives exactly that.
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

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/types', libelle: 'Catégories de collection' }} />
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
              className="champ"
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
                className="champ"
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
                className={`h-11 w-11 rounded-full transition-transform hover:-translate-y-0.5 ${
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
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
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
                {/* A preview of the real shape rather than a name alone: "3/4"
                    says nothing until it is seen next to a square. */}
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
          className="btn-primaire"
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
  // Stable identifier derived from the title: two ChipListField coexist on this
  // form, each must point to ITS own label.
  const labelId = `chip-field-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  function add() {
    const trimmed = newValue.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
    setNewValue('')
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The section title IS the label of the field: without this explicit link,
          a screen reader announces "zone d'édition" with no name (the placeholder
          does not act as a label). */}
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
          className="champ flex-1"
        />
        <button
          type="button"
          onClick={add}
          disabled={!newValue.trim()}
          className="btn-secondaire"
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
              {/* The label of the chip is INSIDE the parent <span>, not in the
                  button: without aria-label, it was announced as "bouton"
                  and nothing more. Invisible in batch 24, which only audited /types/new -
                  a blank form, therefore without any chip (see batch 29). */}
              {/* 24x24 of clickable area for a cross of 12px: below that,
                  the target fails the WCAG 2.5.8 criterion (24x24 minimum) and
                  the spacing exception does not apply, the chips being
                  stuck to each other. The chip compensates with a reduced right
                  padding, so that nothing grows visually. */}
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
