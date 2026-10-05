import { useLayoutEffect, useRef, useState, type ElementType } from 'react'

type Props = {
  /** The whole text. This is what will be offered if the display cuts it. */
  texte: string
  /** The usual truncation classes: `truncate`, `line-clamp-2`… */
  className?: string
  /** Tag rendered. `span` by default; `p`, `h2`… depending on the context. */
  as?: ElementType
  id?: string
}

/**
 * A text that says what it hides.
 *
 * <h2>The flaw</h2>
 * Twenty-two places in the application cut text - `truncate` or
 * `line-clamp-*` - and all of them cut the <b>same thing</b>: a series title, an
 * edition name, a Tier List name, a type label. In other words
 * the information that tells one row from its neighbor. Two editions
 * "Jojo's Bizarre Adventure Part 7 : Steel Ball Run - Édit…" are, on screen,
 * strictly identical, and nothing made it possible to read more.
 *
 * <h2>Why measure rather than set `title` everywhere</h2>
 * A `title` set systematically produces a tooltip that repeats a text
 * already fully readable - noise in the overwhelming majority of cases, since
 * most titles fit. So the component measures: `title` appears
 * only when the rendering is really cut, and disappears if the window
 * grows wide enough to show everything. The {@link ResizeObserver} is used for exactly
 * this: truncation depends on the width, not only on the text.
 *
 * <h2>What this does not solve</h2>
 * A native tooltip assumes a hover: on a touch screen it does not exist.
 * Where the cut text is the only identity of a row, the real answer is
 * to let it wrap rather than cut it. This component is the
 * safety net, not the solution.
 */
export function TexteCoupe({ texte, className, as: Balise = 'span', id }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [coupe, setCoupe] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // +1: widths are fractional, a gap of half a pixel is not
    // a truncation.
    const mesurer = () =>
      setCoupe(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    mesurer()

    // The width of a text changes with the font that renders it. As long as the
    // heading font is not loaded, the browser measures a fallback
    // font: the verdict "it fits" can be wrong by several tens of
    // pixels. And the observer below would not catch it - the
    // box does not move by a pixel when only the font changes.
    let vivant = true
    document.fonts?.ready.then(() => { if (vivant) mesurer() })

    const observateur = new ResizeObserver(mesurer)
    observateur.observe(el)
    return () => {
      vivant = false
      observateur.disconnect()
    }
  }, [texte])

  return (
    <Balise ref={ref} id={id} className={className} title={coupe ? texte : undefined}>
      {texte}
    </Balise>
  )
}
