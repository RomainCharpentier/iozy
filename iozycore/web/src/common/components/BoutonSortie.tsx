import { LogOut } from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * Leaving: <b>one</b> button, in <b>one</b> place, for everyone.
 *
 * <h2>There were two, and that was two too many</h2>
 * "Se déconnecter" lived in the Settings, "Quitter" in the visit banner.
 * Two buttons, two words, two places - for a single action. And the
 * first one was hard to find: three clicks from the avatar (Profile, then
 * Settings, then the Mon compte section), which means nowhere for anyone
 * who does not know the path.
 *
 * <p>There is now only one, in the header, on all screens. A visitor
 * has no profile or settings where to look for an exit (see
 * lib/accesInvite); an account, for its part, had no reason to look for it so
 * far away.
 *
 * <h2>An icon, like its neighbors</h2>
 * No label on screen: the header already carries administration as an icon
 * only, and for the same reason - it must stay calm. A word here would
 * have weighed more than the two buttons together, and it would have had to be made to
 * disappear on mobile, so writing two rules for a single button.
 *
 * <p>The <b>accessible name</b>, for its part, is always there, and it follows who one is:
 * you <b>sign out</b> of an account, you <b>leave</b> a visit - there is
 * no account to leave. This is the name that a screen reader reads, and it is
 * the tooltip that a mouse sees. A mute icon would have been an exit
 * only for those who guess.
 *
 * <h2>Even on failure, we leave</h2>
 * The hook takes care of it (see `useAuth`, `onSettled`): what the person
 * wanted was to leave, and an unreachable server must not lock them
 * into a session that they asked to close.
 */
export function BoutonSortie({ compact = false }: { compact?: boolean }) {
  const { estInvite, deconnexion } = useAuth()
  // The same two sizes as the other header shortcuts: they
  // read as a row, not as three separately drawn buttons.
  const taille = compact ? 'h-11 w-11' : 'h-10 w-10'
  const mot = estInvite ? 'Quitter' : 'Se déconnecter'

  return (
    <button
      type="button"
      onClick={() => deconnexion.mutate()}
      disabled={deconnexion.isPending}
      title={mot}
      aria-label={mot}
      className={`flex ${taille} shrink-0 items-center justify-center rounded-xl text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary disabled:opacity-50`}
    >
      <LogOut size={17} />
    </button>
  )
}
