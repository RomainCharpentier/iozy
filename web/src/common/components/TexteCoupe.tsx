import { useLayoutEffect, useRef, useState, type ElementType } from 'react'

type Props = {
  /** Le texte entier. C'est lui qui sera proposé si l'affichage le rogne. */
  texte: string
  /** Les classes de troncature habituelles : `truncate`, `line-clamp-2`… */
  className?: string
  /** Balise rendue. `span` par défaut ; `p`, `h2`… selon le contexte. */
  as?: ElementType
  id?: string
}

/**
 * Un texte qui dit ce qu'il cache.
 *
 * <h2>Le défaut</h2>
 * Vingt-deux endroits de l'application rognent du texte - `truncate` ou
 * `line-clamp-*` - et tous rognent la <b>même chose</b> : un titre de série, un
 * nom d'édition, un nom de Tier List, un libellé de type. Autrement dit
 * l'information qui distingue une ligne de sa voisine. Deux éditions
 * « Jojo's Bizarre Adventure Part 7 : Steel Ball Run - Édit… » sont, à l'écran,
 * strictement identiques, et rien ne permettait d'en lire davantage.
 *
 * <h2>Pourquoi mesurer plutôt que poser `title` partout</h2>
 * Un `title` posé systématiquement produit une infobulle qui répète un texte
 * déjà entièrement lisible - du bruit sur l'écrasante majorité des cas, puisque
 * la plupart des titres tiennent. Le composant mesure donc : `title` n'apparaît
 * que lorsque le rendu est réellement rogné, et disparaît si la fenêtre
 * s'élargit assez pour tout montrer. Le {@link ResizeObserver} sert exactement
 * à ça : la troncature dépend de la largeur, pas seulement du texte.
 *
 * <h2>Ce que ça ne résout pas</h2>
 * Une infobulle native suppose un survol : sur écran tactile elle n'existe pas.
 * Là où le texte rogné est la seule identité d'une ligne, la vraie réponse est
 * de le laisser passer à la ligne plutôt que de le couper. Ce composant est le
 * filet, pas la solution.
 */
export function TexteCoupe({ texte, className, as: Balise = 'span', id }: Props) {
  const ref = useRef<HTMLElement>(null)
  const [coupe, setCoupe] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // +1 : les largeurs sont fractionnaires, un écart d'un demi-pixel n'est pas
    // une troncature.
    const mesurer = () =>
      setCoupe(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    mesurer()

    // La largeur d'un texte change avec la police qui le rend. Tant que la
    // police de titrage n'est pas chargée, le navigateur mesure une police de
    // repli : le verdict « ça tient » peut être faux de plusieurs dizaines de
    // pixels. Et l'observateur ci-dessous ne rattraperait pas le coup - la
    // boîte, elle, ne bouge pas d'un pixel quand seule la fonte change.
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
