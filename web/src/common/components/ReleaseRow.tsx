import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Jaquette } from './Jaquette'
import { TexteCoupe } from './TexteCoupe'
import { LIBELLES_RELATION, libelleDateCourte } from '@/common/lib/releaseDate'
import type { Retour } from '@/common/lib/retour'
import type { ReleaseEntryDto } from '@/common/types/api'

/**
 * Ce qui appelle une pastille : à acheter est l'action, envie l'attente.
 * Possédé n'appelle rien - un relevé discret suffit, une pastille de plus
 * ferait crier une ligne qui n'a rien à demander.
 */
const PASTILLES: Record<string, string> = {
  MISSING: 'bg-accentTint text-accentText',
  WANTED: 'bg-warningTint text-warning',
}

/**
 * Une sortie du calendrier : la jaquette de ce qui sort, l'œuvre, ce qui sort
 * en son sein, et ce que ça représente pour la collection - toujours écrit,
 * comme la raison d'une opportunité de Découvrir. Partagée par le calendrier
 * et par son aperçu de Découvrir (lot 146), d'où sa place dans `common`.
 *
 * <p>D'où vient la date ne s'écrit pas ici : c'est de la plomberie, et la
 * fiche de l'œuvre la porte déjà pour qui veut savoir.
 *
 * @param date       le libellé de date à écrire en tête de ligne - absent quand
 *                   la liste est déjà groupée par jour
 * @param typeLabel  la catégorie, écrite quand rien de plus précis ne dit ce
 *                   qui sort (un jeu, une œuvre datée à la main)
 */
export function ReleaseRow({
  entry,
  typeLabel,
  date,
  retour,
}: {
  entry: ReleaseEntryDto
  typeLabel?: string
  date?: string
  retour: Retour
}) {
  const sousTitre = entry.label || typeLabel || ''
  const dateAffichee = date ? libelleDateCourte(entry.date) : null
  const relation = LIBELLES_RELATION[entry.relation] ?? entry.relation
  const pastille = PASTILLES[entry.relation]
  return (
    <Link
      to={`/entity/${entry.entityId}`}
      state={{ retour }}
      className="flex w-full items-center gap-3 rounded-2xl border border-surface2 bg-surface p-3 text-left shadow-token-sm transition-transform hover:-translate-y-0.5"
    >
      {dateAffichee && (
        <span className="w-14 shrink-0 text-xs font-semibold text-textDim" aria-label={`Le ${dateAffichee}`}>
          {dateAffichee}
        </span>
      )}
      <Jaquette
        src={entry.coverImageUrl}
        className="h-[58px] w-10 shrink-0 rounded-md object-cover"
        repli={<span className="h-[58px] w-10 shrink-0 rounded-md bg-surface2" />}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <TexteCoupe texte={entry.entityTitle} className="truncate text-sm font-semibold text-textPrimary" />
        {sousTitre && <TexteCoupe texte={sousTitre} className="truncate text-xs text-textDim" />}
      </span>
      {pastille ? (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${pastille}`}>{relation}</span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-textDim">
          <Check size={12} aria-hidden="true" />
          {relation}
        </span>
      )}
    </Link>
  )
}
