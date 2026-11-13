import { Link } from 'react-router-dom'
import { NombreAnime } from '@/common/components/NombreAnime'
import type { LigneAffiche } from './mur'

/** The figure of a line, in its colour: deep in the light theme, bright in the dark one. */

/**
 * The left column of the wall: one big figure, what it is made of, and the
 * way to the rest of the collection. On a wide screen it stays in place while
 * the wall scrolls by.
 */
export function Affiche({
  total,
  lignes,
  totalObjets,
}: {
  total: number
  lignes: LigneAffiche[]
  totalObjets: number | null
}) {
  return (
    <section aria-labelledby="titre-mur" className="flex flex-col lg:sticky lg:top-24 lg:self-start">
      <h1 id="titre-mur" className="font-display font-bold text-textPrimary">
        <span className="sr-only">
          {total} {total > 1 ? 'choses à suivre' : 'chose à suivre'}
        </span>
        <span aria-hidden="true" className="flex flex-wrap items-baseline gap-x-4 lg:block">
          <span className="block text-[clamp(5rem,20vw,7rem)] leading-[0.8] tracking-[-0.07em] lg:text-[clamp(7rem,11vw,10.5rem)]">
            <NombreAnime valeur={total} />
          </span>
          <span className="block text-[1.75rem] leading-none tracking-[-0.04em] lg:mt-4 lg:text-[2.75rem]">
            {total > 1 ? 'choses à suivre.' : 'chose à suivre.'}
          </span>
        </span>
      </h1>

      {lignes.length > 0 && (
        <ul className="mt-6 hidden lg:block">
          {lignes.map((ligne) => (
            <li key={ligne.texte} className="flex items-baseline gap-3 border-t border-lineStrong py-3">
              <span className={`min-w-9 shrink-0 font-display text-[2rem] leading-none font-bold tracking-[-0.04em] iozy-teinte text-accentText`}>
                {ligne.valeur}
              </span>
              <span className="text-[15px] leading-snug text-textPrimary">{ligne.texte}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-textDim lg:mt-5 lg:text-sm">
        Au naturel, ce que tu as. Teintées, tes idées. Assombries, ce qui te manque. En gris, ce qui n’est pas encore sorti.
        <span className="hidden [@media(hover:none)]:inline"> Appui long sur une jaquette pour la retourner.</span>
      </p>

      <div className="mt-6 hidden flex-wrap gap-2.5 lg:flex">
        <Link to="/collection" className="btn-secondaire">
          Toute ta collection{totalObjets != null ? ` · ${totalObjets}` : ''}
        </Link>
      </div>
    </section>
  )
}
