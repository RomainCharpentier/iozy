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
  /** La fiche est-elle sur deux colonnes (voir EntityDetailPage.grilleDeTomes) ?
   *  Si oui, ce groupe se déplie de lui-même au-delà de 1100px - il y a la
   *  place, et la replier ne ferait plus que cacher. */
  enDeuxColonnes: boolean
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
  const enDeuxColonnes = props.enDeuxColonnes

  return (
    <div className="flex flex-col gap-5">
      {/* Le bouton disparaît quand la fiche passe sur deux colonnes.
          L'accordéon était un remède au manque de place : en une colonne, ces
          trois sections repoussaient le bas de page. Mesuré une fois les deux
          colonnes en place : la colonne de droite s'arrêtait à 343px sous une
          colonne gauche de 789px - 446px de vide. Déplié, l'écart tombe à
          160px et la page ne gagne PAS un pixel de hauteur, puisque c'est la
          gauche qui la commande. Là où la place existe, replier ne fait plus
          que cacher. */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className={
          enDeuxColonnes
            ? 'flex w-fit items-center gap-1.5 text-sm text-textDim hover:text-textPrimary min-[1100px]:hidden'
            : 'flex w-fit items-center gap-1.5 text-sm text-textDim hover:text-textPrimary'
        }
      >
        {expanded ? <ChevronDown size={14} /> : <MoreHorizontal size={16} />}
        Plus d'options
        {!expanded && <ChevronRight size={14} />}
      </button>

      {/* Classes écrites en toutes lettres, jamais interpolées : Tailwind
          scanne le code source, une classe construite dynamiquement ne serait
          jamais générée (voir AppShell.CONTAINER_CLASS pour le même écueil). */}
      <div
        className={
          expanded
            ? enDeuxColonnes
              ? 'flex flex-col gap-5 border-t border-surface pt-4 min-[1100px]:border-t-0 min-[1100px]:pt-0'
              : 'flex flex-col gap-5 border-t border-surface pt-4'
            : enDeuxColonnes
              ? 'hidden flex-col gap-5 min-[1100px]:flex'
              : 'hidden flex-col gap-5'
        }
      >
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

        {/* Reste ici, y compris quand le groupe est déplié d'office en deux
            colonnes : DeleteEntitySection porte sa propre confirmation et ne
            s'affiche que comme un lien rouge discret, séparé par sa bordure.
            Ce n'est pas une action banalisée parmi les autres, c'est la
            dernière ligne d'une colonne. */}
        <div className="flex flex-col gap-2 border-t border-danger/20 pt-3">
          <DeleteEntitySection entityId={props.entityId} entityTitle={props.entityTitle} />
        </div>
      </div>
    </div>
  )
}
