import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { listEntityTypes, createEntityType, updateEntityType } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

interface EntityTypeFormPageProps {
  mode: 'create' | 'edit'
}

/** Création/édition d'un type. Les types d'expérience autorisés et les
 * champs personnalisés sont des listes libres en saisie (chaque type MVP
 * historique a la sienne, aucune liste canonique commune n'existe côté
 * backend pour proposer un multi-select) - même formulaire que côté iOS
 * (EntityTypeFormView). */
export function EntityTypeFormPage({ mode }: EntityTypeFormPageProps) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const existing = mode === 'edit' ? entityTypesQuery.data?.find((t) => t.id === id) : undefined

  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [allowedExperienceTypes, setAllowedExperienceTypes] = useState<string[]>([])
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([])

  useEffect(() => {
    if (existing) {
      setCode(existing.code)
      setLabel(existing.label)
      setAllowedExperienceTypes(existing.allowedExperienceTypes)
      setCustomFieldKeys(existing.customFieldKeys)
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? createEntityType({ code, label: label.trim(), allowedExperienceTypes, customFieldKeys })
        : updateEntityType(id!, { label: label.trim(), allowedExperienceTypes, customFieldKeys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityTypes.all })
      navigate('/types')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim() || !code.trim()) return
    mutation.mutate()
  }

  if (mode === 'edit' && entityTypesQuery.isLoading) {
    return <p className="text-textDim">Chargement...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">
        {mode === 'create' ? 'Nouveau type' : 'Modifier le type'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-textDim" htmlFor="label">
              Label
            </label>
            <input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
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
                onChange={(e) => setCode(e.target.value)}
                placeholder="ex : FILM, VINYLE..."
                className="rounded-lg bg-surface2 px-3 py-2 text-sm uppercase text-textPrimary placeholder:text-textDim placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-textDim">Normalisé automatiquement, ne pourra plus être modifié après la création.</p>
            </div>
          )}
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

  function add() {
    const trimmed = newValue.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
    setNewValue('')
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-textDim">{title}</span>
      <div className="flex gap-2">
        <input
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
              className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm text-textPrimary"
            >
              {value}
              <button type="button" onClick={() => onChange(values.filter((v) => v !== value))}>
                <X size={12} className="text-textDim" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
