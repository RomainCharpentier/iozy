import { djb2Hash } from './gradient'
import { gradientPalettes } from './tokens'

/**
 * The color of an avatar, derived from the username.
 *
 * <h2>The palette already exists</h2>
 * These are the six shades of the "covers" without a cover image (see
 * {@link gradientFor}), and the same deterministic hash. Inventing a second
 * range of colors for two letters would have brought one more palette into an
 * application that already has one - and two ranges always end up clashing.
 *
 * <h2>The ink is CHOSEN, not decided in advance</h2>
 * White passes 4.5:1 on five of the six shades; on the sixth
 * ({@code 6B7D5A}, the green one) it falls to 4.46 - just below, invisible
 * to the eye and very real for someone who reads poorly. So for each shade
 * we take the one of white or black that contrasts best: the guaranteed
 * minimum goes up to <b>4.71</b>, whatever the username.
 *
 * <p>This is also why this color does not come from a theme token: it does
 * not adapt to light/dark, it is the same everywhere - as an identity color
 * must be - and it is the internal contrast of the dot that matters, not its
 * match with the background.
 */
export interface CouleurDAvatar {
  /** The background of the dot, in hexadecimal with the hash sign. */
  fond: string
  /** The initials: `#ffffff` or `#000000`, depending on what reads best. */
  encre: string
}

/** Without a username, no color: the avatar keeps its neutral look. */
export function couleurDuPseudo(pseudo: string): CouleurDAvatar | null {
  if (!pseudo.trim()) return null
  const [teinte] = gradientPalettes[djb2Hash(pseudo.trim().toLowerCase()) % gradientPalettes.length]
  return { fond: `#${teinte}`, encre: contrasteAvecBlanc(teinte) >= contrasteAvecNoir(teinte) ? '#ffffff' : '#000000' }
}

function luminance(hex: string): number {
  const canal = (position: number) => {
    const valeur = parseInt(hex.slice(position, position + 2), 16) / 255
    return valeur <= 0.03928 ? valeur / 12.92 : Math.pow((valeur + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
}

function contrasteAvecBlanc(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05)
}

function contrasteAvecNoir(hex: string): number {
  return (luminance(hex) + 0.05) / 0.05
}
