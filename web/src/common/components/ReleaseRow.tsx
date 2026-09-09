import { Link } from 'react-router-dom'
import { Jaquette } from './Jaquette'
import { TexteCoupe } from './TexteCoupe'
import { LIBELLES_RELATION, libelleDateCourte, libelleSource } from '@/common/lib/releaseDate'
import type { Retour } from '@/common/lib/retour'
import type { ReleaseEntryDto } from '@/common/types/api'

/** La pastille par relation : manquant est l'action, possédé la confirmation, envie l'attente. */
const CLASSE_RELATION: Record<string, string> = {
  OWNED: 'bg-softBtn text-textDim',
  MISSING: 'bg-accentTint text-accentText',
  WANTED: 'bg-warningTint text-warningInk',
}

/**
 * Une sortie du calendrier : la jaquette de ce qui sort, l'œuvre, ce qui sort
 * en son sein, et ce que ça représente pour la collection - toujours écrit,
 * comme la raison d'une opportunité de Découvrir. Partagée par le calendrier
 * et par son aperçu de Découvrir (lot 146), d'où sa place dans `common`.
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
        <span className="text-[11px] text-faint">{libelleSource(entry.source)}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${CLASSE_RELATION[entry.relation] ?? CLASSE_RELATION.OWNED}`}>
        {LIBELLES_RELATION[entry.relation] ?? entry.relation}
      </span>
    </Link>
  )
}
