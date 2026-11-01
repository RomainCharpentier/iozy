import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { BandeauVisite } from './BandeauVisite'
import { DesktopHeader } from './DesktopHeader'
import { MobileHeader } from './MobileHeader'
import { PiedDePage } from './PiedDePage'
import { TabBar } from './TabBar'
import { useRefusDeVisite } from '@/common/hooks/useRefusDeVisite'

/** Single switch point between mobile navigation (TabBar, at the bottom, fixed) and
 * desktop navigation (DesktopHeader, at the top, sticky) - see TabBar.tsx
 * (`md:hidden`) and DesktopHeader.tsx (`hidden md:block`), which each apply
 * this same Tailwind value (`md` = 768px) independently: the two
 * are never visible at the same time, without depending on a JS state. */
const NAV_BREAKPOINT_PX = 768

/** Three named content widths rather than scattered route tests
 * in the JSX (see the requested layout rework - "explicit notion" rather than
 * hacks). `wide` = "visual library" screens that must be able to
 * take up a significant part of a wide screen (Ma Collection, detail
 * page); `narrow` = everything else (forms, Settings, Profile...),
 * which stays at the original reading width - never asked to be wider and
 * often less readable when stretched (floating form fields, long
 * lists of links). `medium` is used for "Évaluer un achat".
 *
 * `detail` is the 4th value that the previous comment kept in reserve
 * "the day the need appears". It appeared, and with proof: a
 * screenshot of the detail page of a work shows the content packed to the left and the
 * right side blank on three rows in a row - the row of volumes stops at
 * half width, the Assistant too, and the hero keeps a hole in its middle. A
 * detail page simply has nothing to fill 1600px: its identity block
 * caps at 792px and its actions at 420px, which is 1244px of real content.
 * Wider outer margins rather than inner holes - the former
 * read as a layout, the latter as a defect. */
type ContentWidth = 'wide' | 'detail' | 'medium' | 'narrow'

/** Complete and literal classes (never a number interpolated in a
 * template string): Tailwind scans the SOURCE CODE statically to know
 * which classes to generate - a dynamically built class
 * (`` `md:w-[...${n}px)]` ``) would never be detected and its CSS would
 * never be generated, silently (the component would work in dev through the
 * Vite server that re-scans on the fly, but would break at build). Each
 * variant must therefore appear here word for word. Desktop = `min(100% -
 * 48px, Npx)` centered (never literally a fixed Npx - a window at 1200px
 * with a wide=1600px container must take up ~1152px, not overflow); mobile
 * = full width + 16px of fixed margin (see the requested layout rework). */
const CONTAINER_CLASS: Record<ContentWidth, string> = {
  wide: 'grid grid-cols-[1fr_min(100%_-_2rem,1600px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,1600px)_1fr] [--largeur-page:1600px]',
  detail: 'grid grid-cols-[1fr_min(100%_-_2rem,1320px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,1320px)_1fr] [--largeur-page:1320px]',
  medium: 'grid grid-cols-[1fr_min(100%_-_2rem,960px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,960px)_1fr] [--largeur-page:960px]',
  narrow: 'grid grid-cols-[1fr_min(100%_-_2rem,672px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,672px)_1fr] [--largeur-page:672px]',
}

/**
 * What a FULL-WIDTH band must carry to cross the whole screen, and
 * what its content must carry to stay aligned with the rest of the page.
 *
 * <h2>A three-column grid, and not a `100vw`</h2>
 * `<main>` is a `1fr | content | 1fr` grid: every child falls into the
 * middle column (see the `main[data-grille] > *` rule in index.css), and
 * the one that carries `col-span-full` takes up all three. No `vw` unit comes
 * into play - and it is precisely `100vw` that counts the scrollbar and
 * makes the page overflow by ~15px, the class of bug fixed in Batch 10. The
 * grid only knows the width that is really available.
 *
 * <h2>Why the default rule lives in `@layer base`</h2>
 * Written as a utility (`*:col-start-2`), it would win over the
 * child's `col-span-full`: the parent's selector (`.x > *`) is more
 * specific than the child's class. Placed in the `base` layer, it
 * systematically comes AFTER the utilities in the layer cascade -
 * same reasoning as the hover rule already present in index.css.
 */
export const CLASSE_BANDE_PLEINE_LARGEUR = 'col-span-full'

/** The inner container of a full-width band: brings its content back to
 *  the exact width of the middle column, so that nothing shifts
 *  compared to the rest of the page.
 *
 *  Goes through `--largeur-page`, set just above by the same entry of
 *  CONTAINER_CLASS: without it, a band would hard-code the width of the
 *  screen for which it was written, and would shift as soon as it is
 *  reused elsewhere - which is exactly what we do by sharing it
 *  between the detail page and the add screen. */
export const CLASSE_CONTENU_BANDE =
  'mx-auto w-[calc(100%_-_2rem)] md:w-[min(100%_-_3rem,var(--largeur-page))]'

/** `/entity/:id` covers all types (Manga/Video game/Board game
 * share the same route): the width of the container is neutral for these
 * last two as long as their own layout is not reworked
 * (see EntityDetailPage - out of scope for now). */
function contentWidthFor(pathname: string): ContentWidth {
  // The detail page of a work has its own width - see `detail` above.
  // `/apercu` is the same page, read from the provider: same width, otherwise
  // the hero band would overhang a narrower column.
  if (pathname.startsWith('/entity/') || pathname === '/apercu') return 'detail'
  // The catalogue (lot 198) lays its works out as covers, like a shelf of
  // Ma collection: seven per row at 1,280 px, cramped in 672 px.
  if (
    pathname === '/' ||
    pathname === '/add' ||
    pathname.startsWith('/discover') ||
    pathname.startsWith('/collection/') ||
    pathname === '/tier-lists' ||
    pathname.startsWith('/tier-lists/')
  )
    return 'wide'
  // "Évaluer un achat" is not a settings form: it carries a listing
  // summary, a list of volumes in pills and grouped proposals,
  // cramped in 672 px while the screen is empty around.
  if (pathname.startsWith('/purchase-analysis')) return 'medium'
  // The release calendar places a seven-column grid and, next to it,
  // the list of everything coming during the year (batch 146): two columns that
  // do not fit in 672 px.
  if (pathname.startsWith('/releases')) return 'medium'
  return 'narrow'
}

/** Root layout: scrollable content + navigation, mobile (TabBar,
 * fixed at the bottom) or desktop (DesktopHeader, sticky at the top) depending on the width -
 * never both (see NAV_BREAKPOINT_PX). The clearance for the TabBar
 * (height of the bar + bottom safe-area) is carried by the FOOTER and
 * not by `<main>`: the footer is what ends the page, and the space must be
 * under it so that the version is not read behind the fixed bar. On
 * desktop, there is no bar to clear, hence the lower value. */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const width = contentWidthFor(pathname)
  // Here because it is the only component that wraps ALL the
  // private screens: a visit refusal must be explained wherever it comes from.
  useRefusDeVisite()
  return (
    <div className="min-h-screen bg-background">
      <DesktopHeader />
      <MobileHeader />
      {/* Below the headers and outside `<main>`: it is information about the
          SESSION, not about the page - it must neither scroll with the content nor
          enter the grid that lays it out. Renders nothing outside a visit. */}
      <BandeauVisite />
      {/* `data-grille` is what the base rule of index.css targets to place
          each child in the middle column. An attribute rather than a
          class: it says what the element IS (a page grid), not what
          it looks like, and nothing can replace it by accident when
          rewriting a className. */}
      {/* Keyed by the pathname: a new screen is a new element, so its blocks
          get their entrance (see the `main[data-grille] > *` animation in
          index.css) even when two addresses share the same page component
          - two detail pages in a row, for instance. A search parameter is
          not a new screen and does not remount anything. */}
      <main key={pathname} data-grille className={`${CONTAINER_CLASS[width]} pt-6 pb-6`}>{children}</main>
      {/* The clearance for the thumb bar moved from `main` to this footer:
          it is now the last element of the page, and the space must
          be UNDER it - otherwise the version would be read behind the fixed bar. The
          total document bottom does not change. */}
      <PiedDePage />
      <TabBar />
    </div>
  )
}

// Exported only so that tests/tools can align on the same
// switch point as TabBar/DesktopHeader without duplicating it by hand.
export { NAV_BREAKPOINT_PX }
