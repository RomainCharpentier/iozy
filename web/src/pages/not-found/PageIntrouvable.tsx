import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * What is shown for a URL that the application does not know.
 *
 * There was none: every unknown address rendered a strictly empty `<main>`,
 * with the navigation around it - a screen that looks broken
 * instead of explaining. The case becomes reachable as soon as a route is
 * removed (here "Envies d'amélioration") and a bookmark or a history
 * still points to it, but it already existed for the smallest typo.
 *
 * No error code, no "404": these are server words, and this page
 * is not one. It says what happened and offers the only useful
 * thing - going back to the collection.
 */
export function PageIntrouvable() {
  // A visitor has no collection: their home is the catalog, and the link
  // must name the place it really leads to.
  const { estInvite } = useAuth()
  return (
    <div className="flex flex-col gap-5">
      <EnTeteSection
        niveau={1}
        titre="Cette page n'existe pas"
        sousTitre="L'adresse est peut-être erronée, ou cet écran a été retiré depuis que tu l'as mis en signet."
      />
      <Link
        to={estInvite ? '/add' : '/'}
        className="btn-primaire w-fit"
      >
        <Compass size={16} />
        {estInvite ? 'Retour au catalogue' : 'Retour à ma collection'}
      </Link>
    </div>
  )
}
