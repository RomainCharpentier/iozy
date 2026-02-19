/**
 * Utilitaire pour gérer les variantes de style
 *
 * Pour tester une variante, importez-la dans votre fichier principal :
 *
 * import './styles/variants/minimalist.css'
 * import './styles/variants/glassmorphism.css'
 * import './styles/variants/gaming.css'
 * import './styles/variants/classic.css'
 * import './styles/variants/dark-intense.css'
 */

export const STYLE_VARIANTS = {
  MINIMALIST: 'minimalist',
  GLASSMORPHISM: 'glassmorphism',
  GAMING: 'gaming',
  CLASSIC: 'classic',
  DARK_INTENSE: 'dark-intense',
  DEFAULT: 'default', // Le style actuel dans index.css
} as const

export type StyleVariant = (typeof STYLE_VARIANTS)[keyof typeof STYLE_VARIANTS]

/**
 * Charge dynamiquement une variante de style
 */
export function loadStyleVariant(variant: StyleVariant): void {
  // Retire toutes les variantes existantes
  const existingLinks = document.querySelectorAll('link[data-style-variant]')
  existingLinks.forEach((link) => link.remove())

  if (variant === STYLE_VARIANTS.DEFAULT) {
    return // Utilise le style par défaut
  }

  // Crée un nouveau lien pour la variante
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `/src/styles/variants/${variant}.css`
  link.setAttribute('data-style-variant', variant)
  document.head.appendChild(link)
}

/**
 * Liste des variantes disponibles avec leurs descriptions
 */
export const VARIANT_DESCRIPTIONS = {
  [STYLE_VARIANTS.MINIMALIST]: {
    name: 'Minimaliste & Épuré',
    description: 'Design simple et épuré, très lisible et professionnel',
    emoji: '🎯',
  },
  [STYLE_VARIANTS.GLASSMORPHISM]: {
    name: 'Glassmorphism & Moderne',
    description: 'Effets de verre et transparence, très tendance',
    emoji: '🔮',
  },
  [STYLE_VARIANTS.GAMING]: {
    name: 'Gaming & Gamifié',
    description: 'Style arcade avec effets néon et animations dynamiques',
    emoji: '🎮',
  },
  [STYLE_VARIANTS.CLASSIC]: {
    name: 'Classique & Élégant',
    description: 'Design traditionnel et raffiné, intemporel',
    emoji: '🎩',
  },
  [STYLE_VARIANTS.DARK_INTENSE]: {
    name: 'Dark Mode Intensifié',
    description: 'Dark mode poussé avec contrastes élevés et effets néon',
    emoji: '🌙',
  },
  [STYLE_VARIANTS.DEFAULT]: {
    name: 'Par défaut',
    description: "Le style actuel de l'application",
    emoji: '✨',
  },
} as const
