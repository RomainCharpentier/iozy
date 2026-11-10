import { useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { Contexte } from './usePleinCadre'
import { useTheme } from '@/common/lib/theme'
import { TERRACOTTA, deriverTeintes, enRgb } from '@/common/lib/teinte/derivation'
import { useAccent } from '@/common/lib/accent'
import { useTeinteJaquette } from '@/common/lib/teinte/useTeinteJaquette'

/**
 * The "plein cadre" look (lot 210): the cover of the moment fills the screen,
 * blurred, and lends its colors to the whole interface.
 *
 * <h2>Who says which cover</h2>
 * A page declares it (`usePleinCadre(url)`): the detail page its cover, the
 * collection the cover of the work that moved last. The shell owns the rest:
 * it reads the colors once, derives the two tones for the current theme (see
 * lib/teinte/derivation, which keeps every text AA over the worst cover), and
 * writes them on <html> as `--teinte-sombre`, `--teinte-vive`,
 * `--teinte-encre`. The accent of the app is an alias of the vivid tone, so
 * buttons, progress bars, the top bar and what is missing all follow, and the
 * dialogs rendered outside the shell too.
 *
 * <h2>When the brand color stands in</h2>
 * Without a cover, or while it is read, the terracotta tones are used. When
 * the host of the image refuses to let it be read (CORS), the app says so in
 * one discreet line in the footer (see {@link NotePleinCadre}), never in a
 * banner: it is a curiosity, not a failure.
 */
const VARIABLES = ['--teinte-sombre', '--teinte-vive', '--teinte-encre', '--teinte-voile-part'] as const

export function PleinCadreProvider({ children }: { children: ReactNode }) {
  const [url, declarer] = useState<string | null>(null)
  const { theme } = useTheme()
  const couleurs = useTeinteJaquette(url)
  const { principale, connue, repli } = couleurs
  const [r, g, b] = principale

  // Until the cover is read, the colors of the previous one stay: a flash of
  // terracotta between two blue series would read as a third color.
  // "Terracotta" chosen on the profile (lot 218): the brand tones whatever
  // the cover. The backdrop still shows the cover; only the accent stays put.
  const accent = useAccent()
  const teintes = useMemo(() => {
    if (accent === 'TERRACOTTA') return deriverTeintes(TERRACOTTA, theme)
    return connue ? deriverTeintes([r, g, b], theme) : null
  }, [accent, connue, r, g, b, theme])

  useLayoutEffect(() => {
    if (!teintes) return
    const style = document.documentElement.style
    style.setProperty('--teinte-sombre', enRgb(teintes.sombre))
    style.setProperty('--teinte-vive', enRgb(teintes.vive))
    style.setProperty('--teinte-encre', enRgb(teintes.encre))
    style.setProperty('--teinte-voile-part', `${Math.round(teintes.voileAlpha * 100)}%`)
  }, [teintes])

  // The glass reflex follows the pointer: two variables on the root, read by
  // `.iozy-verre`. Touch screens never move it, so nothing shows there.
  useEffect(() => {
    const suivre = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const racine = document.documentElement.style
      racine.setProperty('--souris-x', `${e.clientX}px`)
      racine.setProperty('--souris-y', `${e.clientY}px`)
    }
    window.addEventListener('pointermove', suivre, { passive: true })
    return () => window.removeEventListener('pointermove', suivre)
  }, [])

  // Leaving the shell (signing out) gives the page back its default tones.
  useEffect(
    () => () => {
      for (const nom of VARIABLES) document.documentElement.style.removeProperty(nom)
    },
    [],
  )

  // The CORS note explains a fallback the person did not choose: with the
  // terracotta chosen, there is nothing to explain.
  const valeur = useMemo(
    () => ({ url, declarer, repli: connue && accent === 'AUTO' ? repli : null }),
    [url, connue, repli, accent],
  )
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

/** The full-screen backdrop: the blurred cover under its veil. Decorative. */
export function FondPleinCadre() {
  const { url } = useContext(Contexte)
  return (
    <div aria-hidden="true" className="fond-plein-cadre">
      {url && <img key={url} src={url} alt="" className="fond-plein-cadre__image" decoding="async" />}
      <div className="fond-plein-cadre__voile" />
    </div>
  )
}

/** Shown when the brand color stands in because the image host refused CORS. */
export const NOTE_CORS = 'Couleurs par défaut : l’hôte de cette jaquette ne laisse pas lire ses couleurs.'

/** The one discreet line, for the footer. Renders nothing in the usual case. */
export function NotePleinCadre() {
  const { repli } = useContext(Contexte)
  if (repli !== 'cors') return null
  return (
    <p className="mt-1 text-xs text-textDim" title={NOTE_CORS}>
      {NOTE_CORS}
    </p>
  )
}
