import { djb2Hash } from './gradient'
import { gradientPalettes } from './tokens'

/**
 * La couleur d'un avatar, déduite du pseudo.
 *
 * <h2>La palette existe déjà</h2>
 * Ce sont les six teintes des « couvertures » sans jaquette (voir
 * {@link gradientFor}), et le même hash déterministe. Inventer une seconde
 * gamme de couleurs pour deux lettres aurait fait entrer une palette de plus
 * dans une application qui en a une - et deux gammes finissent toujours par
 * jurer ensemble.
 *
 * <h2>L'encre est CHOISIE, pas décidée d'avance</h2>
 * Le blanc passe le 4.5:1 sur cinq des six teintes ; sur la sixième
 * ({@code 6B7D5A}, la verte) il tombe à 4,46 - juste en dessous, invisible à
 * l'œil et bien réel pour qui lit mal. On prend donc, pour chaque teinte, celle
 * du blanc ou du noir qui contraste le mieux : le minimum garanti passe à
 * <b>4,71</b>, quel que soit le pseudo.
 *
 * <p>C'est aussi pourquoi cette couleur ne vient pas d'un token de thème : elle
 * ne s'adapte pas au clair/sombre, elle est la même partout - comme une
 * couleur d'identité doit l'être - et c'est le contraste interne du pastille
 * qui compte, pas son accord avec le fond.
 */
export interface CouleurDAvatar {
  /** Le fond de la pastille, en hexadécimal avec le croisillon. */
  fond: string
  /** Les initiales : `#ffffff` ou `#000000`, selon ce qui se lit le mieux. */
  encre: string
}

/** Sans pseudo, aucune couleur : l'avatar garde son aspect neutre. */
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
