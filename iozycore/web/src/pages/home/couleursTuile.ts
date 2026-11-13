import { useMemo, type CSSProperties } from 'react'
import { useTheme } from '@/common/lib/theme'
import { TERRACOTTA, deriverTeintes, enRgb } from '@/common/lib/teinte/derivation'
import { useTeinteJaquette } from '@/common/lib/teinte/useTeinteJaquette'

/**
 * The colours of one tile of the wall, taken from a cover (lot 233).
 *
 * <h2>One source of colour</h2>
 * The wall used a fixed palette of five tints (ochre, green, pink, blue,
 * orange), with no link to the covers beside them. A tile now takes the tone
 * of its own cover, or of the work a block of colour talks about: the same
 * derivation as the backdrop (`deriverTeintes`), so the same contrast rules.
 *
 * <h2>Three variables</h2>
 * - `--mur-fond`, a flat block (a block of colour, the back of a turned
 *   tile, an idea's tint), and `--mur-encre`, the text on it: the vivid tone
 *   and the ink of the current theme, as on a primary button;
 * - `--mur-clair`, a figure or a name laid on a darkened cover: the vivid
 *   tone of the DARK theme, always light, readable in both themes.
 *
 * Without a cover, while it is read, or when it cannot be read, the tile
 * takes the colour of the page (the cover of the moment).
 */
const CLAIR_PAR_DEFAUT = enRgb(deriverTeintes(TERRACOTTA, 'dark').vive)

const REPLI = {
  '--mur-fond': 'var(--color-vive)',
  '--mur-encre': 'var(--color-encreVive)',
  '--mur-clair': CLAIR_PAR_DEFAUT,
} as CSSProperties

export function useCouleursTuile(jaquette: string | null): CSSProperties {
  const { theme } = useTheme()
  const { principale, connue, repli } = useTeinteJaquette(jaquette)
  const [r, g, b] = principale
  return useMemo(() => {
    if (!jaquette || !connue || repli) return REPLI
    const ici = deriverTeintes([r, g, b], theme)
    const sombre = deriverTeintes([r, g, b], 'dark')
    return {
      '--mur-fond': enRgb(ici.vive),
      '--mur-encre': enRgb(ici.encre),
      '--mur-clair': enRgb(sombre.vive),
    } as CSSProperties
  }, [jaquette, connue, repli, r, g, b, theme])
}
