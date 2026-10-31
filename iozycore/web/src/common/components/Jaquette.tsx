import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  /** The URL of the cover. Absent or empty: `repli` is rendered directly. */
  src: string | null | undefined
  /** The classes of the image itself. */
  className?: string
  /**
   * What is displayed instead. Each screen already had its own for the case
   * "no cover at all" - a flat color, a volume number, a small title.
   * We pass it back to it as it is: the rendering does not change by one pixel,
   * only the failure case joins the absence case.
   */
  repli: ReactNode
  /** Lazy by default (batch 141): a list of volumes or suggestions
   *  only loads what is close to the screen. `eager` for the cover of the
   *  hero of a detail page, which is always the first thing we see. */
  loading?: 'lazy' | 'eager'
}

/**
 * A cover that has a plan B.
 *
 * <h2>The flaw</h2>
 * Twenty-one `img` tags in the application, <b>only one</b> handled
 * `onError` (CoverTile). Everywhere else, a URL that no longer answered left
 * a hole: the frame keeps its size, nothing is displayed in it. Measured on the detail page
 * of a work, the most visible image of the application - 112 × 168 pixels of
 * emptiness, and the container without any background behind.
 *
 * <p>This is not a lab case: these URLs point to external hosts
 * (Google Books, BGG). They break, change, or refuse to be
 * displayed from another site - and the application knows nothing about it until
 * the image has tried to load.
 *
 * <h2>Why a component</h2>
 * The remedy fits in one `onError`, but written twenty times it would be forgotten the
 * twenty-first time - which is exactly what happened. Here the rule lives in a
 * single place.
 */
export function Jaquette({ src, className, repli, loading = 'lazy' }: Props) {
  // We remember the faulty URL, not a simple boolean: otherwise, fixing the
  // cover of a series ("Modifier la couverture") would leave the fallback
  // displayed for the NEW URL, which has never failed.
  const [urlEnEchec, setUrlEnEchec] = useState<string | null>(null)
  // The URL that has ARRIVED, for the same reason: a new cover starts
  // invisible again until it is really there.
  const [urlChargee, setUrlChargee] = useState<string | null>(null)
  const ref = useRef<HTMLImageElement>(null)

  // An image served from the cache is complete before React attaches
  // `onLoad` in some browsers: it would stay invisible for ever.
  useEffect(() => {
    const img = ref.current
    if (src && img && img.complete && img.naturalWidth > 0) setUrlChargee(src)
  }, [src])

  if (!src || src === urlEnEchec) return <>{repli}</>

  // Fades in once downloaded (batch 191): a cover that pops in over its
  // fallback, a few hundred milliseconds after the page, read as a glitch.
  const arrivee = urlChargee === src
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      loading={loading}
      onLoad={() => setUrlChargee(src)}
      onError={() => setUrlEnEchec(src)}
      className={`${className ?? ''} transition-opacity duration-300 ${arrivee ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}
