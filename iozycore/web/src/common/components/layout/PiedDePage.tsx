import { useQuery } from '@tanstack/react-query'
import { VERSION_INTERFACE, estUneLivraison, lireVersionServeur, versionCourte } from '@/common/api/version'
import { queryKeys } from '@/common/lib/queryKeys'

/**
 * Which release is running - small, at the bottom of every page.
 *
 * <h2>Why in the footer, and not in the Settings</h2>
 * It lived there first, and it was a filing mistake: nobody looks for
 * a version, one READS it when in doubt, which means anywhere
 * in the application and without wanting to leave it. A serial number is not
 * filed in the options; it is placed at the bottom of what it identifies.
 *
 * <h2>Why it exists</h2>
 * Since updates arrive by themselves, we no longer know from
 * memory what is online: we push, and something arrives five
 * minutes later. Faced with unexpected behavior, the first question
 * becomes "is my fix even deployed?" - and without an
 * answer, we look for a defect in code that is not there yet.
 *
 * <h2>A number, because a number can be compared</h2>
 * Major.Minor.Patch, deduced from the commit messages at publication (see
 * web/scripts/version.mjs). Faced with "Version 1.3.1" and "serveur 1.2.0", we
 * know without opening anything which of the two images is late - two SHAs
 * could not be compared - and of what nature the gap was. The number leads to
 * the code: it labels the delivered commit (`git show v1.3.1`) as much as the published
 * image.
 *
 * <h2>"Version", and above all not "Livraison"</h2>
 * The right word, in the internal vocabulary of this repository, would be "livraison" (delivery).
 * It is taken: the purchase analysis calls "livraison" the SHIPPING COSTS
 * of a listing ("Livraison non incluse", see docs/LISTING_SOURCES.md), and
 * this footer is displayed down to the bottom of that screen. One word for two
 * things on the same page always costs more than a synonym.
 *
 * <h2>Two versions, but a single line when they agree</h2>
 * The interface and the server are two distinct images, pulled separately.
 * Displaying both permanently would give the same thing twice in the normal
 * case; showing only the server one would lie in
 * the case that matters - a service worker that keeps the old shell, one
 * image out of two that was not pulled. The second one therefore appears ONLY if
 * it differs, and then says what to do: a gap is almost always fixed
 * by reloading.
 *
 * <h2>At the door too, and that is where it is most useful</h2>
 * The sign-in screen lives OUTSIDE the shell (see `PorteFermee` in App.tsx):
 * it therefore had no footer, and it was the screen where the question
 * is strongest - when you cannot get in, you first want to know what is
 * running. `sansSession` makes it possible there: the interface number is
 * compiled into the file, it asks nobody for anything. The server one,
 * for its part, is not requested - the route requires a session, and one more 401 in
 * the console would teach nothing to someone who already reads "Version 379".
 *
 * <h2>Two drafts do not diverge</h2>
 * On a workstation, the interface carries `1.1.0-dev` (derived from the commits
 * by vite.config.ts) and the API answers `dev`: two different values, but no
 * gap to fix - these are two local builds, they have no
 * reason to match. Announcing "serveur dev, rechargez" on every screen
 * would teach people to ignore the line that counts the day the gap is real.
 * The gap is therefore only flagged between two RELEASES.
 *
 * <h2>Silent when it does not know</h2>
 * The call to the server does not retry and announces no error: not
 * knowing the running version is not a failure, and certainly not a red
 * banner at the bottom of all pages. The interface version, for its part,
 * is always there - it is compiled into the file.
 */
export function PiedDePage({ sansSession = false }: { sansSession?: boolean } = {}) {
  // `staleTime: Infinity`: it only changes on redeploy, and the call
  // therefore happens once per session, not at every screen change.
  const versionServeur = useQuery({
    queryKey: queryKeys.version,
    queryFn: lireVersionServeur,
    staleTime: Infinity,
    retry: false,
    enabled: !sansSession,
  })

  const serveur = versionServeur.data?.version ?? null
  const ecartReel =
    serveur !== null &&
    serveur !== VERSION_INTERFACE &&
    estUneLivraison(serveur) &&
    estUneLivraison(VERSION_INTERFACE)

  return (
    // The bottom clearance only exists for the fixed tab bar, which
    // belongs to the shell: at the door, it would clear nothing and would push
    // the centered form up by 96 px.
    <footer
      className={
        sansSession ? 'text-center text-xs text-textDim' : 'pb-24 text-center text-xs text-textDim md:pb-10'
      }
    >
      {/* A plain link, not a router one: the home page is the root of the
          site, outside the app. */}
      <a href="/" className="underline underline-offset-2">
        Toutes les apps
      </a>
      {' · '}
      <span>
        Version {versionCourte(VERSION_INTERFACE)}
        {ecartReel && (
          <>
            {' '}· serveur {versionCourte(serveur)} —{' '}
            <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2">
              recharger
            </button>
          </>
        )}
      </span>
    </footer>
  )
}
