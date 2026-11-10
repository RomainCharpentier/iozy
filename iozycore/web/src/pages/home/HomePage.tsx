import { CLASSE_CARTE } from '@/common/components/Carte'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Squelette } from '@/common/components/Squelette'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { useNow } from '@/common/hooks/useNow'
import { BlocUne } from './BlocUne'
import { BlocAussi, BlocChiffre, BlocPresqueFini } from './BlocsDeLaSemaine'
import { BlocRayons } from './BlocRayons'
import { useSemaine } from './useSemaine'

function dateDuJour(now: Date): string {
  const texte = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(now)
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/**
 * The home page "ta semaine" (lot 212), laid out like a magazine: the lead,
 * also this week, the number, almost done, then the shelves. The server
 * composes the week from the works read model (GET /api/home/week); this page
 * only writes it in French. Every block has its own empty state: a new account
 * sees the shape of its week, and where to start.
 *
 * <p>The backdrop is the cover of the lead (plein cadre); without a lead, the
 * brand tones.
 */
export function HomePage() {
  const now = useNow()
  const { semaine, typesParId, chargement, erreur, reessayer, reessaiEnCours } = useSemaine()
  usePleinCadre(semaine?.une?.work.coverImageUrl ?? null)

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
          <h1 className="font-display text-[clamp(3.5rem,10.5vw,9rem)] leading-[0.8] font-bold tracking-[-0.06em] text-textPrimary">
            Ta semaine
          </h1>
          <p className="pb-1 text-sm text-textDim">{dateDuJour(now)} · composée avec ta collection</p>
        </div>
        <div aria-hidden="true" className="mt-4 h-0.5 bg-textPrimary/80" />
        <div aria-hidden="true" className="mt-[3px] h-px bg-textPrimary/25" />
      </header>

      {erreur ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorBanner message={`Ta semaine n'a pas pu être chargée : ${erreur.message}`} />
          <button type="button" onClick={reessayer} disabled={reessaiEnCours} className="btn-secondaire">
            {reessaiEnCours ? 'Nouvelle tentative…' : 'Réessayer'}
          </button>
        </div>
      ) : chargement || !semaine ? (
        <div aria-busy="true" aria-label="Chargement de ta semaine" className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className={CLASSE_CARTE}>
            <Squelette lignes={6} />
          </div>
          <div className={CLASSE_CARTE}>
            <Squelette lignes={6} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <BlocUne une={semaine.une} now={now} />
            <aside aria-label="Le reste de ta semaine" className="flex flex-col gap-7 lg:border-l lg:border-textPrimary/20 lg:pl-8">
              <BlocAussi aussi={semaine.aussi} now={now} />
              <div aria-hidden="true" className="h-px bg-textPrimary/20" />
              <BlocChiffre chiffre={semaine.chiffre} now={now} />
              <div aria-hidden="true" className="h-px bg-textPrimary/20" />
              <BlocPresqueFini presqueFini={semaine.presqueFini} />
            </aside>
          </div>
          <BlocRayons rayons={semaine.rayons} typesParId={typesParId} />
        </>
      )}
    </div>
  )
}
