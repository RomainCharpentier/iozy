import { Link, useLocation } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { initiales } from '@/common/lib/initiales'
import { BoutonSortie } from '@/common/components/BoutonSortie'
import { BoutonTheme } from '@/common/components/BoutonTheme'
import { useAuth } from '@/common/hooks/useAuth'

/** The theme, administration and exit buttons share one glass capsule. */
const GROUPE = 'iozy-verre flex h-[52px] items-center gap-0.5 rounded-full px-1'

/**
 * The two header accesses: <b>administration</b>, and the profile.
 *
 * <h2>Two buttons, and that is the point</h2>
 * Administration has its <b>own button</b>, next to the avatar and not
 * inside it. It took three tries to find its place: under Settings, then
 * as a link on Profile, then in a dropdown menu of the avatar - three times
 * put away behind something that belongs to the user. Yet declaring
 * the categories of one's collection or filling in a reference edition is
 * not a personal setting: it is the tooling of the application, and it is not
 * found by looking for one's profile.
 *
 * <p>What it does not contain, on the other hand: the BGG import, which ADDS to the
 * collection and so lives in Rechercher, next to Scanner.
 *
 * <h2>Two links, and no menu</h2>
 * The avatar leads straight to Profile - one click, not a panel to open then
 * close again for a choice between two entries. The settings are ON Profile
 * (batch 140), in plain view: a single screen talks about the same person.
 *
 * <h2>And the exit, which applies to everyone</h2>
 * {@link BoutonSortie} goes with them, and it is the ONLY place from which one
 * leaves - "Se déconnecter" lived three clicks from here, in the Settings,
 * which means nowhere for anyone who does not know the path.
 *
 * <h2>And the theme, for everyone (batch 138)</h2>
 * {@link BoutonTheme} opens the row: light or dark in one click, where one
 * is, instead of three clicks to the Settings. An icon that shows the
 * current mode, a name that says the action - the same rule as its neighbors.
 *
 * <h2>During a visit: the theme, the exit, and nothing else</h2>
 * The profile and administration both talk about "one's own home", which a
 * visitor does not have. The avatar, above all, would have shown initials that
 * are nobody's: the only place in the application that says "this is
 * you" would have lied. The theme, for its part, is a setting of the device, not of the
 * account: it stays.
 *
 * <h2>What these buttons are not</h2>
 * Navigation destinations. The four daily intentions live
 * in {@code NAV_ITEMS} and nowhere else; this is what belongs
 * to none of them.
 *
 * <h2>The "Envies" heart was removed (2026-08-28)</h2>
 * It no longer led to a screen of its own since Batch 38: the wishes are a
 * READING of Ma collection, and the heart only set the filter before
 * navigating there. Yet this page already carries "Tout / À compléter / Suivies / Envies" in its
 * views bar: the shortcut doubled a visible button, permanently, on
 * all screens. The count is not lost: the views bar shows
 * "Envies · N" where the number is read together with what it counts.
 *
 * <h2>The initials of the pseudo, and its color (2026-08-29)</h2>
 * The avatar used to show "IO" hard-coded - the initials of the application, on the
 * button that leads to someone's account. It now carries the initials of the
 * pseudo, on a tint derived from it (see {@code theme/avatar}): on an
 * instance with several people, two accounts are no longer told apart only by
 * two letters one reads, but by a color one recognizes without reading.
 *
 * <h2>A ring in the color of the cover (lot 210)</h2>
 * The avatar is now the round glass piece of the top bar: the initials in the
 * text color, ringed by the vivid tone of the cover on screen. The color of
 * the pseudo gave way: one accent at a time, and it is the cover's.
 *
 * <p>The fallback stays "IO", and it is reachable: this
 * component lives in the {@code AppShell}, which only renders when signed in, but the
 * account arrives through a request - so there is a moment, at first
 * load, when it is not there yet. A color that would appear then would
 * read as a change of identity.
 */
export function GlobalShortcuts({ compact = false }: { compact?: boolean }) {
  const { compte, estInvite } = useAuth()
  const { pathname } = useLocation()

  // A visitor has neither profile nor administration: both would lead to
  // screens reserved for accounts (see lib/accesInvite). What remains is the
  // exit, in the same place as for everyone - it is even the only
  // place from which they can leave.
  if (estInvite) {
    // The same nesting as below: the theme button keeps its node when the
    // account turns out to be a visit.
    return (
      <div className="flex items-center gap-3">
        <div className={GROUPE}>
          <BoutonTheme compact={compact} />
          <BoutonSortie compact={compact} />
        </div>
      </div>
    )
  }

  const taille = compact ? 'h-11 w-11' : 'h-10 w-10'
  const marque = initiales(compte?.pseudo ?? '') || 'IO'
  // The pseudo is SAID, not only drawn: "RO" read aloud by a
  // screen reader tells nobody anything.
  const intitule = compte ? `Mon profil — ${compte.pseudo}` : 'Mon profil'
  const surAdministration = pathname.startsWith('/administration')

  return (
    <div className="flex items-center gap-3">
      <div className={GROUPE}>
      <BoutonTheme compact={compact} />

      {/* The tooling of the application, on its own button. An icon only:
          the header must stay calm, and "Administration" next to an avatar
          would make two labels for two things that are rarely opened. The name is
          carried by `aria-label` AND `title` - title alone is the last
          resort of the accessible name algorithm, and does not exist with a finger
          (see Batch 29). */}
      <Link
        to="/administration"
        title="Administration"
        aria-label="Administration"
        aria-current={surAdministration ? 'page' : undefined}
        className={`flex ${taille} shrink-0 items-center justify-center rounded-full transition-colors ${
          surAdministration
            ? 'bg-textPrimary text-background'
            : 'text-textDim hover:bg-rowHover hover:text-textPrimary'
        }`}
      >
        <Wrench size={17} />
      </Link>

      <BoutonSortie compact={compact} />
      </div>

      <Link
        to="/profile"
        title={intitule}
        aria-label={intitule}
        aria-current={pathname === '/profile' ? 'page' : undefined}
        className={`iozy-verre iozy-avatar iozy-teinte ${compact ? '!h-11 !w-11 !text-sm' : ''}`}
      >
        {marque}
      </Link>
    </div>
  )
}
