import { NombreAnime } from '@/common/components/NombreAnime'
import { Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useOutlet } from 'react-router-dom'
import { ScanSearch, ShoppingBag } from 'lucide-react'
import { cleLigne } from '@/common/hooks/useJeLAi'
import { useAcheter } from './useAcheter'
import { BlocBudget } from './BlocBudget'
import { LigneAAcheter } from './LigneAAcheter'
import { PanneauLateral } from './PanneauLateral'
import { detailDepense, libelleMoisDepense } from '@/common/lib/libellesAchat'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EtatVide } from '@/common/components/EtatVide'
import { Squelette, SqueletteListe } from '@/common/components/Squelette'
import { formaterEuros } from '@/common/lib/formats'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'

/**
 * "À acheter" (lot 216): the third goal of the owner, managing purchases.
 *
 * <h2>Three things, one screen</h2>
 * <ul>
 *   <li>the month spent, in a huge number: the prices of the copies bought
 *       this month, by purchase date (see MonthSpending on the server);</li>
 *   <li>the optional budget, a ring in the vivid tone when it is set;</li>
 *   <li>ONE list of what to buy: releases ahead, what completes an ongoing
 *       work, wishes - soonest release first, then the work closest to
 *       complete. "Je l'ai" acts in place, at once, with "Annuler".</li>
 * </ul>
 *
 * <h2>The listing analysis opens beside it</h2>
 * "Analyser une annonce" opens the existing analysis in a side panel, at
 * `/to-buy/analyse` (a child route: the router renders it in the outlet,
 * and this page draws the panel). `/purchase-analysis` keeps working on its
 * own.
 *
 * <h2>The backdrop</h2>
 * The cover of the first thing to buy: what the page is about right now.
 */
export function ToBuyPage() {
  const { liste, mois, jeLAi, budget } = useAcheter()
  const panneau = useOutlet()
  const navigate = useNavigate()
  const types = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const lignes = liste.data ?? []
  const premiere = lignes[0]
  usePleinCadre(premiere ? (premiere.elements[0]?.coverImageUrl ?? premiere.coverImageUrl) : null)

  const nombre = lignes.length
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 lg:grid lg:grid-cols-[440px_minmax(0,1fr)] lg:items-stretch lg:gap-0">
      {/* The page name for screen readers; the eye reads it from the nav and the list title. */}
      <h1 className="sr-only lg:col-span-2">À acheter</h1>
      <section aria-labelledby="titre-depense" className="flex min-w-0 flex-col gap-3 bg-accent p-7 text-accentInk lg:min-h-[34rem] lg:p-9 [&_.iozy-verre]:!bg-background [&_.iozy-verre]:text-textPrimary">
        <h2 id="titre-depense" className="iozy-teinte text-[13px] font-bold tracking-[0.16em] uppercase">
          {mois.data ? libelleMoisDepense(mois.data.month) : 'Dépensé ce mois-ci'}
        </h2>
        {mois.isPending ? (
          <Squelette lignes={2} />
        ) : mois.isError ? (
          <ErrorBanner message={mois.error.message} />
        ) : (
          <>
            <p className="font-display text-[clamp(56px,15vw,150px)] leading-[0.85] font-bold tracking-[-0.06em] [overflow-wrap:anywhere]">
              <NombreAnime valeur={mois.data.spent} format={formaterEuros} />
            </p>
            <p className="text-base font-medium">{detailDepense(mois.data.pricedCount, mois.data.unpricedCount)}</p>
            <div className="mt-3">
              <BlocBudget
                depense={mois.data.spent}
                budget={mois.data.monthlyBudget}
                enregistrement={budget.isPending}
                onEnregistrer={(montant) => budget.mutateAsync(montant)}
              />
            </div>
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to="analyse" className="btn-secondaire !bg-background !text-textPrimary">
            <ScanSearch size={16} />
            Analyser une annonce
          </Link>
        </div>
      </section>

      <section aria-labelledby="titre-liste" className="flex min-w-0 flex-col gap-3 lg:pl-10">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="titre-liste" className="font-display text-xl font-bold text-textPrimary">
            À trouver
          </h2>
          {nombre > 0 && (
            <p className="text-sm text-textDim">
              {nombre} ligne{nombre > 1 ? 's' : ''}
            </p>
          )}
        </div>
        {liste.isPending ? (
          <SqueletteListe lignes={5} />
        ) : liste.isError ? (
          <ErrorBanner message={liste.error.message} />
        ) : nombre === 0 ? (
          <EtatVide
            icone={ShoppingBag}
            titre="Rien à acheter pour l’instant."
            detail="Tes envies, ce qui manque à tes collections en cours et les sorties à venir arriveront ici."
          />
        ) : (
          <ul className="iozy-verre iozy-verre--fort flex flex-col rounded-[28px] px-4 py-1.5 sm:px-6">
            {lignes.map((ligne) => (
              <LigneAAcheter
                key={cleLigne(ligne)}
                ligne={ligne}
                type={types.data?.find((t) => t.id === ligne.entityTypeId)}
                onJeLAi={() => jeLAi.mutate(ligne)}
              />
            ))}
          </ul>
        )}
      </section>

      {panneau && (
        <PanneauLateral titre="Analyser une annonce" onFermer={() => navigate('/to-buy')}>
          {/* The analysis loads on demand: only the panel waits, not the page. */}
          <Suspense fallback={<Squelette lignes={6} />}>{panneau}</Suspense>
        </PanneauLateral>
      )}
    </div>
  )
}
