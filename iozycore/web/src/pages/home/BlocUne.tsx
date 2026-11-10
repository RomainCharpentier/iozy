import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { EtatVide } from '@/common/components/EtatVide'
import type { HomeElementDto, HomeLeadDto } from '@/common/types/home'
import { Couverture } from './Couverture'
import { pourquoiLaUne, surtitreDeLaUne, titreDeSortie } from './phrases'

/**
 * Beyond this, one segment per element would be a hairline: the sentence says it
 * alone. At 390 px, 60 outlined segments (3 px each at least) fit only with a 1 px gap.
 */
const SEGMENTS_MAX = 60

/**
 * Where the work stands, one segment per element: owned (full), missing (the
 * outline that breathes), still to come (dashed). Read aloud as one sentence.
 */
function Jauge({ elements }: { elements: HomeElementDto[] }) {
  if (elements.length < 2 || elements.length > SEGMENTS_MAX) return null
  const possedes = elements.filter((e) => e.state === 'OWNED').length
  const manquants = elements.filter((e) => e.countedAsMissing).length
  const aVenir = elements.filter((e) => e.state === 'UPCOMING').length
  const parties = [`${possedes} possédé${possedes > 1 ? 's' : ''}`]
  if (manquants > 0) parties.push(`${manquants} manquant${manquants > 1 ? 's' : ''}`)
  if (aVenir > 0) parties.push(`${aVenir} à venir`)
  return (
    <div role="img" aria-label={parties.join(', ')} className="mt-6 flex h-3 gap-px overflow-hidden sm:gap-[3px]">
      {elements.map((e) => (
        <span
          key={e.key}
          className={`min-w-0 flex-1 rounded-[2px] ${
            e.state === 'OWNED'
              ? 'bg-accent'
              : e.countedAsMissing
                ? 'iozy-manque !rounded-[2px]'
                : e.state === 'UPCOMING'
                  ? 'border border-dashed border-textDim'
                  : 'bg-surface2'
          }`}
        />
      ))}
    </div>
  )
}

/**
 * "À la une": the work this week is about - a release of the collection, or
 * the work that moved last. Its cover is also the backdrop of the page.
 */
export function BlocUne({ une, now }: { une: HomeLeadDto | null; now: Date }) {
  if (!une) {
    return (
      <section aria-labelledby="titre-une">
        <h2 id="titre-une" className="sr-only">À la une</h2>
        <EtatVide
          icone={Sparkles}
          titre="Ta semaine commence ici."
          detail="Ajoute une première œuvre avec « Chercher ou ajouter » : elle fera la une, et ses sorties avec elle."
          action={
            <Link
              to="/add"
              className="btn-primaire"
            >
              Ajouter une œuvre
            </Link>
          }
        />
      </section>
    )
  }
  const { work } = une
  const titre = une.reason === 'RELEASE' && une.release ? titreDeSortie(work, une.release, now) : work.title
  return (
    <article aria-labelledby="titre-une" className="flex flex-col gap-6 sm:flex-row sm:gap-10">
      <Link to={`/entity/${work.entityId}`} className="self-center sm:self-start" tabIndex={-1} aria-hidden="true">
        <Couverture
          url={work.coverImageUrl}
          titre={work.title}
          loading="eager"
          className="aspect-[2/3] w-44 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.65)] sm:w-60 lg:w-72"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accentText">{surtitreDeLaUne(une)}</p>
        <h2
          id="titre-une"
          className="mt-3 font-display text-[clamp(2.5rem,4.8vw,4.9rem)] [overflow-wrap:anywhere] font-bold leading-[0.86] tracking-[-0.055em] text-textPrimary [text-wrap:balance]"
        >
          {titre}
        </h2>
        <p className="mt-5 text-base leading-relaxed text-textDim md:text-lg">{pourquoiLaUne(une, now)}</p>
        <Jauge elements={une.elements} />
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to={`/entity/${work.entityId}`}
            className="btn-primaire"
          >
            Ouvrir la fiche
          </Link>
          <Link
            to="/releases"
            className="btn-secondaire"
          >
            Toutes les sorties
          </Link>
        </div>
      </div>
    </article>
  )
}
