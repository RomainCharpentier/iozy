import { useEffect } from 'react'

const BASE = 'IozyCore'

/**
 * Makes the document title follow the title of the displayed page.
 *
 * <h2>What its absence cost</h2>
 * The seventeen routes all carried the title "IozyCore", while each one
 * displays a distinct `<h1>`. Three consequences, one of them about
 * accessibility:
 * <ul>
 *   <li>the browser history became unreadable - ten "IozyCore" entries do
 *       not let you go back anywhere;</li>
 *   <li>a tab kept open did not say what it was on;</li>
 *   <li><b>an SPA navigation announces nothing</b> to a screen reader: the
 *       page does not reload, so there is no event to announce. Updating the
 *       title is the conventional remedy.</li>
 * </ul>
 *
 * <h2>Why read the `h1` rather than declare a list</h2>
 * A "route → label" table would have duplicated texts that are already
 * written in the pages, and this repository has already been bitten several
 * times by two lists that diverge. The `h1` <b>is</b> the title of the page,
 * in the semantic sense: reading it avoids keeping a second one.
 *
 * <p>Unexpected benefit: the dynamic routes follow for free. The detail page
 * of a series displays "Naruto · IozyCore" without any table having to know
 * the works of the catalog.
 *
 * <h2>The title sometimes arrives after the first render</h2>
 * A page that waits for its data displays a skeleton without an `h1`. A simple
 * `querySelector` at the time of navigation would miss it. A
 * {@link MutationObserver} therefore waits for it to appear, disconnects as
 * soon as it has found it, and gives up after a delay rather than observing
 * indefinitely.
 */
/**
 * @param cle what, when it changes, can change the displayed `h1`. The route,
 *            obviously - but not only: the authentication gate replaces the
 *            whole screen <b>without</b> changing the URL, and the title then
 *            stayed the one of the sign-in screen ("IozyCore") once the
 *            collection was displayed. A key, not a path.
 */
export function useDocumentTitleFromHeading(cle: string): void {
  useEffect(() => {
    const appliquer = (titre: string | null | undefined) => {
      const propre = (titre ?? '').replace(/\s+/g, ' ').trim()
      // "IozyCore · IozyCore": the title of a screen that carries the name of
      // the application does not get suffixed with itself.
      document.title = !propre || propre.toLowerCase() === BASE.toLowerCase() ? BASE : `${propre} · ${BASE}`
    }

    // `main h1` first, then any `h1`: the public share page lives outside the
    // shell and has no `<main>`. Without this fallback it kept the base title
    // even though it does display a title.
    const lire = () =>
      (document.querySelector('main h1') ?? document.querySelector('h1'))?.textContent

    // "…" is the placeholder title of a page whose label arrives later
    // (a shelf, a general ranking): it is not a title, we wait for the real
    // one - otherwise the tab stayed "… · IozyCore" (batch 148).
    const utilisable = (titre: string | null | undefined) => !!titre && !/^[\s.…]*$/.test(titre)

    const immediat = lire()
    if (utilisable(immediat)) {
      appliquer(immediat)
      return
    }

    // No title yet: the page is loading. We start again from the base so as
    // not to leave the one of the previous page, which would be wrong.
    appliquer(null)

    // Same fallback for the observation: without `<main>`, we watch the body.
    const cible = document.querySelector('main') ?? document.body
    if (!cible) return

    const observateur = new MutationObserver(() => {
      const trouve = lire()
      if (utilisable(trouve)) {
        appliquer(trouve)
        observateur.disconnect()
      }
    })
    // `characterData`: React replaces the TEXT of an h1 that is already
    // rendered ("…" then "Manga") without touching its nodes - an observation
    // limited to the children would never see it.
    observateur.observe(cible, { childList: true, subtree: true, characterData: true })

    // A page that has no h1 at all must not leave a live observer behind it.
    const abandon = setTimeout(() => observateur.disconnect(), 5000)

    return () => {
      observateur.disconnect()
      clearTimeout(abandon)
    }
  }, [cle])
}
