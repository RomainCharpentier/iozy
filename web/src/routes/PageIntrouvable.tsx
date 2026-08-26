import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EnTeteSection } from '../components/EnTeteSection'

/**
 * Ce qui s'affiche pour une URL que l'application ne connaît pas.
 *
 * Il n'y en avait aucune : toute adresse inconnue rendait un `<main>`
 * strictement vide, avec la navigation autour - un écran qui a l'air cassé
 * plutôt que d'expliquer. Le cas devient atteignable dès qu'une route est
 * retirée (ici « Envies d'amélioration ») et qu'un signet ou un historique
 * pointe encore dessus, mais il existait déjà pour la moindre faute de frappe.
 *
 * Ni code d'erreur, ni « 404 » : ce sont des mots de serveur, et cette page
 * n'en est pas un. Elle dit ce qui s'est passé et propose la seule chose
 * utile — revenir à la collection.
 */
export function PageIntrouvable() {
  return (
    <div className="flex flex-col gap-5">
      <EnTeteSection
        niveau={1}
        titre="Cette page n'existe pas"
        sousTitre="L'adresse est peut-être erronée, ou cet écran a été retiré depuis que tu l'as mis en signet."
      />
      <Link
        to="/"
        className="flex min-h-11 w-fit items-center gap-2 rounded-[14px] bg-accent px-4 text-sm font-semibold text-accentInk"
      >
        <Compass size={16} />
        Retour à ma collection
      </Link>
    </div>
  )
}
