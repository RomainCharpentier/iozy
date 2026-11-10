import { Link } from 'react-router-dom'
import { CalendarDays, Hash, Puzzle } from 'lucide-react'
import { EtatVide } from '@/common/components/EtatVide'
import type { HomeAlmostDoneDto, HomeFigureDto, HomeItemDto } from '@/common/types/home'
import { Couverture } from './Couverture'
import { NombreAnime } from '@/common/components/NombreAnime'
import { legendeDuChiffre, ligneAussi, titrePresqueFini } from './phrases'

/** The kicker of a block, in the vivid tone. */
function Surtitre({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-xs font-bold uppercase tracking-[0.14em] text-accentText">
      {children}
    </h2>
  )
}

/** "Aussi cette semaine": the other releases and moves of the week, up to four. */
export function BlocAussi({ aussi, now }: { aussi: HomeItemDto[]; now: Date }) {
  return (
    <section aria-labelledby="titre-aussi">
      <Surtitre id="titre-aussi">Aussi cette semaine</Surtitre>
      {aussi.length === 0 ? (
        <EtatVide compact icone={CalendarDays} titre="Rien d'autre cette semaine." detail="Les sorties de tes œuvres et tes ajouts viendront ici." />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {aussi.map((item) => {
            const { titre, detail } = ligneAussi(item, now)
            return (
              <li key={item.work.entityId}>
                <Link
                  to={`/entity/${item.work.entityId}`}
                  className="flex min-h-11 items-center gap-4 rounded-xl hover:bg-rowHover"
                >
                  <Couverture url={item.work.coverImageUrl} titre={item.work.title} className="h-20 w-14" />
                  <span className="min-w-0">
                    <span className="block font-display text-xl leading-tight font-bold text-textPrimary">{titre}</span>
                    {detail && <span className="mt-1 block text-sm text-textDim">{detail}</span>}
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

/** "Le chiffre": the objects of the collection, in very large type. */
export function BlocChiffre({ chiffre, now }: { chiffre: HomeFigureDto | null; now: Date }) {
  if (!chiffre) {
    return (
      <section aria-labelledby="titre-chiffre">
        <Surtitre id="titre-chiffre">Le chiffre</Surtitre>
        <EtatVide compact icone={Hash} titre="Aucun objet pour l'instant." detail="Chaque exemplaire que tu ajoutes compte ici." />
      </section>
    )
  }
  const { libelle, details } = legendeDuChiffre(chiffre, now)
  return (
    <section aria-labelledby="titre-chiffre">
      <Surtitre id="titre-chiffre">Le chiffre</Surtitre>
      <p className="mt-1 flex items-baseline gap-3">
        <span className="font-display text-7xl leading-none font-bold tracking-[-0.04em] text-textPrimary md:text-8xl">
          <NombreAnime valeur={chiffre.totalObjects} />
        </span>
        <span className="text-sm leading-snug text-textDim md:text-base">
          {libelle}
          {details.map((d) => (
            <span key={d} className="block">
              {d}
            </span>
          ))}
        </span>
      </p>
    </section>
  )
}

/**
 * "Presque fini": the works that lack one to three elements. The missing
 * ones breathe in the vivid tone. No generic "I have it" exists yet for an
 * element of any type (a volume needs its edition), so each one leads to the
 * entity page, where it is added - the label says so, never "je l'ai".
 */
export function BlocPresqueFini({ presqueFini }: { presqueFini: HomeAlmostDoneDto[] }) {
  return (
    <section aria-labelledby="titre-presque-fini">
      <Surtitre id="titre-presque-fini">Presque fini</Surtitre>
      {presqueFini.length === 0 ? (
        <EtatVide compact icone={Puzzle} titre="Rien de presque fini pour l'instant." detail="Une œuvre à trois éléments du complet, ou moins, viendra ici." />
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {presqueFini.map(({ work, missing }) => (
            <li key={work.entityId} className="flex items-start gap-4">
              <Couverture url={work.coverImageUrl} titre={work.title} className="h-20 w-14" />
              <div className="min-w-0">
                <Link
                  to={`/entity/${work.entityId}`}
                  className="block font-display text-lg leading-tight font-bold text-textPrimary hover:underline"
                >
                  {titrePresqueFini(work)}
                </Link>
                <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Ce qui manque à ${work.title}`}>
                  {missing.map((element) => (
                    <li key={element.key}>
                      <Link
                        to={`/entity/${work.entityId}`}
                        aria-label={`${element.label} : l'ajouter depuis la fiche`}
                        title={`${element.label} : l'ajouter depuis la fiche`}
                        className="iozy-manque iozy-teinte flex min-h-11 items-center rounded-xl px-3 font-display text-sm font-bold"
                      >
                        {element.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
