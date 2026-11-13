import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Squelette } from '@/common/components/Squelette'
import { useJeLAi } from '@/common/hooks/useJeLAi'
import { useWishlist } from '@/common/hooks/useWishlist'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '@/common/lib/coverImage'
import { Affiche } from './Affiche'
import type { Tuile } from './mur'
import { TuileMur } from './TuileMur'
import { useMur } from './useMur'

/**
 * The home page, "le mur" (lot 219): what moves in the collection, and ideas.
 *
 * On the left, a poster: how many things there are to follow, and what they
 * are. On the right, a mosaic of square covers and blocks of colour, set by
 * mur.ts. A click on a cover opens the work; its small round button turns it
 * over to say why it is there and to act on it without leaving the page.
 */
export function HomePage() {
  const { mur, totalObjets, chargement, erreur, reessayer, reessaiEnCours } = useMur()
  const jeLAi = useJeLAi()
  const envies = useWishlist()
  const [ouverte, setOuverte] = useState<string | null>(null)

  // A click anywhere outside the turned tile turns it back.
  useEffect(() => {
    if (!ouverte) return
    const dehors = (event: PointerEvent) => {
      const tuile = (event.target as Element | null)?.closest('[data-tuile]')
      if (tuile?.getAttribute('data-tuile') !== ouverte) setOuverte(null)
    }
    document.addEventListener('pointerdown', dehors)
    return () => document.removeEventListener('pointerdown', dehors)
  }, [ouverte])

  function agir(tuile: Tuile) {
    const action = tuile.action
    if (!action) return
    if (action.type === 'jeLAi') jeLAi.mutate(action.ligne)
    else
      envies.add({
        entityTypeId: action.idee.entityTypeId!,
        title: action.idee.title,
        attributes: action.idee.imageUrl ? { [COVER_IMAGE_ATTRIBUTE_KEY]: action.idee.imageUrl } : {},
      })
    setOuverte(null)
  }

  if (erreur) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorBanner message={`Ton mur n'a pas pu être chargé : ${erreur.message}`} />
        <button type="button" onClick={reessayer} disabled={reessaiEnCours} className="btn-secondaire">
          {reessaiEnCours ? 'Nouvelle tentative…' : 'Réessayer'}
        </button>
      </div>
    )
  }
  if (chargement) {
    return (
      <div aria-busy="true" aria-label="Chargement de ton mur" className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <Squelette lignes={6} />
        <Squelette lignes={8} />
      </div>
    )
  }
  if (mur.tuiles.length === 0) return <MurVide />

  const enAttente = mur.tuiles.some((t) => t.genre === 'ATTENTE')
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] lg:gap-12">
      <Affiche total={mur.total} lignes={mur.lignes} totalObjets={totalObjets} />

      <section aria-label="Ton mur" className="min-w-0 [container-type:inline-size]">
        <p aria-live="polite" className="sr-only">
          {enAttente ? 'Une IA cherche des idées pour toi.' : ''}
        </p>
        <ul className="grid grid-flow-dense [--colonnes:3] [grid-auto-rows:calc(100cqw/var(--colonnes))] [grid-template-columns:repeat(var(--colonnes),minmax(0,1fr))] sm:[--colonnes:4] xl:[--colonnes:5] 2xl:[--colonnes:6]">
          {mur.tuiles.map((tuile, i) => (
            <TuileMur
              key={tuile.cle}
              tuile={tuile}
              rang={i % 8}
              ouverte={ouverte === tuile.cle}
              basculer={setOuverte}
              agir={agir}
              actionEnCours={jeLAi.isPending || envies.isPending}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}

/** A new account: one big place for the first cover, and three ways to put it there. */
function MurVide() {
  return (
    <div className="flex min-h-[28rem] flex-col justify-end gap-6 bg-surface p-8 lg:min-h-[40rem]">
      <p aria-hidden="true" className="font-display text-[10rem] leading-[0.8] font-medium text-textDim">
        +
      </p>
      <h1 className="font-display text-5xl leading-[0.95] font-bold tracking-[-0.04em] text-textPrimary">
        Ta première jaquette
        <br />
        ira ici.
      </h1>
      <div className="flex flex-wrap gap-2.5">
        <Link to="/add" className="btn-primaire">
          Chercher un titre
        </Link>
        <Link to="/scan" className="btn-secondaire">
          Scanner un code
        </Link>
        <Link to="/import-photo" className="btn-secondaire">
          Photographier mon étagère
        </Link>
      </div>
    </div>
  )
}
