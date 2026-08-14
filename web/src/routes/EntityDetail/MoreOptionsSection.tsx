import { useState } from 'react'
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { TagsSection } from './TagsSection'
import { ExperiencesSection } from './ExperiencesSection'
import { RelationshipsSection } from './RelationshipsSection'
import { DeleteEntitySection } from './DeleteEntitySection'
import type { ExperienceResponse, RelationshipDto, TagDto, VariantDto } from '../../types/api'

interface MoreOptionsSectionProps {
  entityId: string
  entityTitle: string
  attachedTagIds: string[]
  allTags: TagDto[]
  experiences: ExperienceResponse[]
  allowedExperienceTypes: string[]
  variants: VariantDto[]
  relationshipsFrom: RelationshipDto[]
  relationshipsTo: RelationshipDto[]
}

/**
 * Regroupe tout ce qui n'est ni "voir ma collection" ni "gérer un tome" (voir
 * l'audit UX fiche série : la page ne doit pas donner l'impression de lister
 * toutes les fonctionnalités applicables à une Entity, mais montrer "ma
 * collection Naruto"). Tags/Expériences/Relations restent entièrement
 * fonctionnels - juste repliés derrière un clic plutôt que d'occuper une
 * place permanente entre la grille de tomes et le bas de page. Repliée par
 * défaut, comme les autres détails secondaires de cette fiche (voir
 * AddVolumeSection/OwnershipsSection pour le même principe).
 * <p>
 * "Supprimer cette fiche" vit ici aussi plutôt qu'en libre accès au bas de
 * page : déjà protégée par sa propre confirmation (voir DeleteEntitySection),
 * mais une action destructive n'a pas sa place parmi les actions normales de
 * consultation - une section supplémentaire à ouvrir la rend accessible sans
 * pour autant la rendre banale.
 */
export function MoreOptionsSection(props: MoreOptionsSectionProps) {
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-fit items-center gap-1.5 text-sm text-textDim hover:text-textPrimary"
      >
        <MoreHorizontal size={16} />
        Plus d'options
        <ChevronRight size={14} />
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-5 border-t border-surface pt-4">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="flex w-fit items-center gap-1.5 text-sm text-textDim hover:text-textPrimary"
      >
        <ChevronDown size={14} />
        Plus d'options
      </button>

      <TagsSection entityId={props.entityId} attachedTagIds={props.attachedTagIds} allTags={props.allTags} />

      <ExperiencesSection
        entityId={props.entityId}
        experiences={props.experiences}
        allowedExperienceTypes={props.allowedExperienceTypes}
        variants={props.variants}
      />

      <RelationshipsSection
        entityId={props.entityId}
        relationshipsFrom={props.relationshipsFrom}
        relationshipsTo={props.relationshipsTo}
      />

      <div className="flex flex-col gap-2 border-t border-danger/20 pt-3">
        <DeleteEntitySection entityId={props.entityId} entityTitle={props.entityTitle} />
      </div>
    </div>
  )
}
