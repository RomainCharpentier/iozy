import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { listTags, renommerTag, supprimerTag } from '../../api/tags'
import { searchEntities } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { EnTeteSection } from '../../components/EnTeteSection'
import { LienRetour } from '../../components/LienRetour'
import { CLASSE_CARTE } from '../../components/Carte'
import type { TagDto } from '../../types/api'

/**
 * Les tags de l'instance, et de quoi faire le ménage.
 *
 * <h2>Ce qui manquait</h2>
 * On pouvait créer un tag et l'attacher, puis (depuis le 2026-08-29) filtrer
 * dessus. Jamais le <b>renommer</b> ni le <b>supprimer</b> : une faute de
 * frappe était définitive, et la liste du filtre ne faisait que grossir.
 * Exactement le défaut « poser sans pouvoir gérer » déjà corrigé pour les prix
 * relevés.
 *
 * <h2>Le décompte vient d'ici, pas d'une route de plus</h2>
 * Combien d'œuvres portent ce tag ? La réponse est dans les œuvres, que Ma
 * collection charge déjà et garde en cache (\`entities.search\`) : ajouter un
 * endpoint pour un nombre affiché sur un écran d'administration serait payer
 * une route pour ce qu'on a sous la main.
 *
 * <p>Le décompte n'est pas décoratif : c'est lui qui dit ce qu'une suppression
 * va détacher. « Supprimer un tag posé sur 12 œuvres » et « supprimer un tag
 * qui ne sert à rien » ne sont pas le même geste.
 */
export function TagsPage() {
  const queryClient = useQueryClient()
  const [enEdition, setEnEdition] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  const tagsQuery = useQuery({ queryKey: queryKeys.tags.all, queryFn: listTags })
  const oeuvresQuery = useQuery({ queryKey: queryKeys.entities.search({}), queryFn: () => searchEntities({}) })

  const usages = new Map<string, number>()
  for (const oeuvre of oeuvresQuery.data ?? []) {
    for (const tagId of oeuvre.tagIds) usages.set(tagId, (usages.get(tagId) ?? 0) + 1)
  }

  function rafraichir() {
    queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    // Les œuvres portent les identifiants de tags : un tag supprimé les rend
    // périmées, et le filtre de Ma collection les lit.
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  }

  const suppression = useMutation({
    mutationFn: supprimerTag,
    onSuccess: () => {
      setASupprimer(null)
      rafraichir()
    },
  })

  const tags = [...(tagsQuery.data ?? [])].sort((a, b) => a.label.localeCompare(b.label, 'fr'))

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/administration', libelle: 'Administration' }} />
      <EnTeteSection
        niveau={1}
        titre="Tags"
        sousTitre="Les étiquettes posées sur les œuvres. Elles décrivent l'œuvre, pas une collection : elles sont communes à tous les comptes."
      />

      {tagsQuery.isError && <ErrorBanner message={tagsQuery.error.message} />}
      {tagsQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {tagsQuery.isSuccess && tags.length === 0 && (
        <p className="text-textDim">
          Aucun tag pour l'instant. Ils se créent depuis une fiche d'œuvre, dans « Plus d'options ».
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {tags.map((tag) => (
          <li key={tag.id} className={CLASSE_CARTE}>
            <LigneTag
              tag={tag}
              usages={usages.get(tag.id) ?? 0}
              enEdition={enEdition === tag.id}
              enConfirmation={aSupprimer === tag.id}
              onRenommer={() => setEnEdition(tag.id)}
              onRenommé={() => {
                setEnEdition(null)
                rafraichir()
              }}
              onAnnulerRenommage={() => setEnEdition(null)}
              onDemanderSuppression={() => setASupprimer(tag.id)}
              onAnnulerSuppression={() => setASupprimer(null)}
              onConfirmerSuppression={() => suppression.mutate(tag.id)}
              suppressionEnCours={suppression.isPending}
            />
            {aSupprimer === tag.id && suppression.isError && <ErrorBanner message={suppression.error.message} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LigneTag({
  tag,
  usages,
  enEdition,
  enConfirmation,
  onRenommer,
  onRenommé,
  onAnnulerRenommage,
  onDemanderSuppression,
  onAnnulerSuppression,
  onConfirmerSuppression,
  suppressionEnCours,
}: {
  tag: TagDto
  usages: number
  enEdition: boolean
  enConfirmation: boolean
  onRenommer: () => void
  onRenommé: () => void
  onAnnulerRenommage: () => void
  onDemanderSuppression: () => void
  onAnnulerSuppression: () => void
  onConfirmerSuppression: () => void
  suppressionEnCours: boolean
}) {
  const [libelle, setLibelle] = useState(tag.label)

  const renommage = useMutation({
    mutationFn: () => renommerTag(tag.id, libelle.trim()),
    onSuccess: onRenommé,
  })

  const porte = usages === 0 ? "Sur aucune œuvre" : `Sur ${usages} œuvre${usages > 1 ? 's' : ''}`

  if (enEdition) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (libelle.trim()) renommage.mutate()
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            aria-label={`Nouveau nom du tag ${tag.label}`}
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-2 text-sm text-textPrimary focus:ring-2 focus:ring-accent/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!libelle.trim() || renommage.isPending}
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accentInk disabled:opacity-50"
          >
            <Check size={14} />
            Renommer
          </button>
          <button
            type="button"
            onClick={onAnnulerRenommage}
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs text-textDim"
          >
            <X size={14} />
            Annuler
          </button>
        </div>
        {/* Renommer ne détache rien : le tag garde son identité, seul son nom
            change - sur les 12 œuvres d'un coup, pas une par une. */}
        <span className="text-xs text-textDim">{porte} — le nouveau nom s'appliquera partout.</span>
        {renommage.isError && <ErrorBanner message={renommage.error.message} />}
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-textPrimary">{tag.label}</span>
          <span className="text-xs text-textDim">{porte}</span>
        </span>
        {!enConfirmation && (
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onRenommer}
              aria-label={`Renommer le tag ${tag.label}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-textDim hover:bg-rowHover hover:text-textPrimary"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onDemanderSuppression}
              aria-label={`Supprimer le tag ${tag.label}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-textDim hover:bg-dangerTint hover:text-dangerText"
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </div>

      {enConfirmation && (
        <div className="flex flex-col gap-2.5">
          {/* Ce qui part, et ce qui reste : la crainte qu'on a le doigt sur le
              bouton est de perdre les œuvres, pas l'étiquette. */}
          <p className="text-sm text-dangerText">
            Supprimer le tag « {tag.label} » ?{' '}
            {usages > 0
              ? `Il sera retiré des ${usages} œuvre${usages > 1 ? 's' : ''} qui le portent — elles, ne bougent pas.`
              : 'Aucune œuvre ne le porte.'}{' '}
            Cette action est irréversible.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onConfirmerSuppression}
              disabled={suppressionEnCours}
              className="rounded-xl bg-danger px-3.5 py-2.5 text-[13px] font-semibold text-dangerInk disabled:opacity-50"
            >
              {suppressionEnCours ? 'Suppression...' : 'Confirmer la suppression'}
            </button>
            <button
              type="button"
              onClick={onAnnulerSuppression}
              className="rounded-xl px-3.5 py-2.5 text-[13px] text-textDim"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
