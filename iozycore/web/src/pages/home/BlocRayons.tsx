import { Link } from 'react-router-dom'
import { ArrowRight, LibraryBig } from 'lucide-react'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { EtatVide } from '@/common/components/EtatVide'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import type { EntityTypeDto } from '@/common/types/api'
import type { HomeShelfDto } from '@/common/types/home'
import { Couverture } from './Couverture'
import { contenuDuRayon } from './phrases'

/**
 * "Dans tes rayons": one shelf per category the account owns something in -
 * custom ones included - with its counts and three covers in the shape of the
 * type. A shelf opens its category; the heading link opens the whole collection.
 */
export function BlocRayons({ rayons, typesParId }: { rayons: HomeShelfDto[]; typesParId: Map<string, EntityTypeDto> }) {
  return (
    <section aria-labelledby="titre-rayons" className={CLASSE_CARTE}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="titre-rayons" className="text-xs font-bold uppercase tracking-[0.14em] text-accentText">
          Dans tes rayons
        </h2>
        {rayons.length > 0 && (
          <Link to="/collection" className="btn-discret !px-0">
            Toute ma collection <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>
      {rayons.length === 0 ? (
        <div className="mt-3">
          <EtatVide compact icone={LibraryBig} titre="Tes rayons sont vides." detail="Chaque catégorie où tu possèdes une œuvre aura son rayon ici." />
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {rayons.map((rayon) => {
            const type = typesParId.get(rayon.entityTypeId)
            const aspect = getEntityTypeVisual(type).aspectClassName
            const nom = type?.label ?? 'Catégorie'
            return (
              <li key={rayon.entityTypeId}>
                <Link
                  to={`/collection/${rayon.entityTypeId}`}
                  className="flex min-h-11 items-center gap-4 rounded-xl hover:bg-rowHover"
                >
                  {rayon.covers.length > 0 && (
                    <span className="flex shrink-0 items-end -space-x-5">
                      {rayon.covers.map((c) => (
                        <Couverture key={c.entityId} url={c.coverImageUrl} titre={c.title} className={`${aspect} h-20 w-auto ring-1 ring-ligneVerre`} />
                      ))}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-bold text-textPrimary">{nom}</span>
                    <span className="mt-0.5 block text-sm text-textDim">{contenuDuRayon(rayon.workCount, rayon.objectCount)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
