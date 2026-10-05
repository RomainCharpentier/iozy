import { useLayoutEffect } from 'react'
import { useNavigationType } from 'react-router-dom'

/**
 * Opening a screen means seeing its top.
 *
 * <h2>What its absence gave</h2>
 * A single-page application reloads nothing: the scroll position therefore
 * survives navigation. Scrolling down in "Ma collection" and then touching a
 * work opened its detail page <b>at the same height</b>. Measured between two
 * detail pages: starting from 902 px on one, we arrived at 1055 px on the
 * other, its title off screen, the "Assistant" section at the top of the
 * screen - in the middle of a page that had just been opened.
 *
 * <p>The flaw hides well: it only shows if the arrival page is at least as
 * tall as the current offset, otherwise the browser brings everything back
 * within bounds on its own. With five works in the database, almost nothing;
 * with a real collection, systematic.
 *
 * <h2>Why only forward</h2>
 * `POP` - back and forward - is left to the browser, which restores very
 * well: checked, 1200 px found again to the pixel on a detail page. Taking
 * control of it would only damage something that works.
 *
 * <h2>Why a LAYOUT effect</h2>
 * Two reasons, and the second is the real one.
 * <ol>
 *   <li>The jump happens during the commit, before the first display: we
 *       never see the page appear shifted and then re-center.</li>
 *   <li>React runs ALL the layout effects before any ordinary effect. A
 *       screen that deliberately aims at a precise section does so in a
 *       `useEffect` - see ProfilePage, which scrolls down to the sharing
 *       section when you arrive by the shortcut. In `useEffect` here, this
 *       hook would have won the race (the effects of a parent run after those
 *       of its children) and canceled this intention. In `useLayoutEffect`,
 *       it runs before: the screen keeps the last word on its own
 *       destination.</li>
 * </ol>
 */
export function useScrollToTopOnNavigation(pathname: string): void {
  const typeDeNavigation = useNavigationType()

  useLayoutEffect(() => {
    if (typeDeNavigation === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, typeDeNavigation])
}
