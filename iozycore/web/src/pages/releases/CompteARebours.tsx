import { Link } from 'react-router-dom'
import { NombreAnime } from '@/common/components/NombreAnime'
import { Jaquette } from '@/common/components/Jaquette'
import { titreDuJour } from '@/common/lib/releaseDate'
import type { Retour } from '@/common/lib/retour'
import type { ReleaseEntryDto } from '@/common/types/api'
import { compteARebours, estManquante } from './releaseCalendar'


/**
 * The next release, as the top of the page (lot 215, mock-up "Sorties"): the
 * day it comes out, the days left in a huge number, what it is, and its cover,
 * which the shell also spreads blurred behind the whole screen (usePleinCadre,
 * declared by the page).
 *
 * <p>The cover breathes when the collection does not have the release yet; the
 * primary button then says the gesture. No state written under it.
 */
export function CompteARebours({
  entry,
  aujourdHui,
  typeLabel,
  aspectClassName,
  retour,
  onJeLAi,
  enCours,
}: {
  entry: ReleaseEntryDto
  aujourdHui: string
  typeLabel: string | undefined
  aspectClassName: string
  retour: Retour
  /** Absent for a guest, who writes nothing. */
  onJeLAi?: (entry: ReleaseEntryDto) => void
  enCours: boolean
}) {
  const { nombre, mot } = compteARebours(entry, aujourdHui)
  const manquante = estManquante(entry)
  const auJour = entry.precision === 'DAY'
  const sousTitre = [entry.label, typeLabel].filter(Boolean).join(' · ')

  return (
    <section aria-labelledby="prochaine-sortie" className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-3">
        <p className="iozy-teinte text-[13px] font-semibold tracking-[0.16em] text-accentText uppercase">
          {auJour ? `Prochaine sortie · ${titreDuJour(entry.date)}` : 'Prochaine sortie'}
        </p>
        <p className="flex flex-wrap items-end gap-x-5 gap-y-1">
          {/* A paragraph cannot carry a name (ARIA 1.2): the sentence is read from a hidden span. */}
          <span className="sr-only">{mot ? `Dans ${nombre} ${mot}` : nombre}</span>
          <span
            aria-hidden="true"
            className={`font-display leading-[0.8] font-bold tracking-[-0.05em] text-textPrimary ${
              /^\d+$/.test(nombre) ? 'text-[112px] md:text-[168px]' : 'text-6xl md:text-8xl'
            }`}
          >
            {/^\d+$/.test(nombre) ? <NombreAnime valeur={Number(nombre)} /> : nombre}
          </span>
          {mot && <span aria-hidden="true" className="pb-2 text-xl font-semibold text-textDim md:pb-3.5">{mot}</span>}
        </p>
        <h2 id="prochaine-sortie" className="font-display text-4xl leading-[0.95] font-bold tracking-[-0.03em] text-textPrimary md:text-[56px]">
          {entry.entityTitle}
        </h2>
        {sousTitre && <p className="text-[17px] text-textDim">{sousTitre}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {manquante && onJeLAi && (
            <button type="button" className="btn-primaire" disabled={enCours} onClick={() => onJeLAi(entry)}>
              Je l'ai précommandé
            </button>
          )}
          <Link to={`/entity/${entry.entityId}`} state={{ retour }} className="btn-secondaire">
            Voir la fiche
          </Link>
        </div>
      </div>
      <Jaquette
        src={entry.coverImageUrl}
        className={`w-48 justify-self-center rounded-[22px] object-cover shadow-token-elevated md:w-72 ${aspectClassName} ${
          manquante ? 'iozy-manque' : ''
        }`}
        repli={<span className={`w-48 justify-self-center rounded-[22px] bg-surface2 md:w-72 ${aspectClassName} ${manquante ? 'iozy-manque' : ''}`} />}
      />
    </section>
  )
}
