import styles from '@/components/common/Logo.module.scss'

interface LogoProps {
  size?: 'small' | 'medium' | 'large'
  showText?: boolean
  className?: string
}

const SIZE_CLASSES = {
  small: styles.logoSmall,
  medium: styles.logoMedium,
  large: styles.logoLarge,
} as const

const SVG_SIZES = { small: 40, medium: 64, large: 96 } as const

/**
 * La marque IozyPlay : un triangle « lecture » posé sur une étagère, dans une
 * tuile à l'accent. L'étagère est le trait de famille partagé avec IozyCore
 * (trois tranches sur la même étagère) ; le triangle dit ce que fait l'app.
 *
 * SVG en ligne et non <img src="/logo.svg"> : la tuile suit ainsi le thème
 * CHOISI DANS L'APP (var(--accent-primary) / var(--accent-ink)), alors que
 * public/favicon.svg, qui vit dans le chrome du navigateur, suit celui du
 * système. Même dessin dans les deux fichiers : toute retouche se fait aux deux.
 */
function LogoMark({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="IozyPlay"
      className={styles.logoImg}
    >
      <rect width="32" height="32" rx="7.5" fill="var(--accent-primary)" />
      <path
        d="M10.5 8.4 L24.5 16.1 L10.5 23.8 Z"
        fill="var(--accent-ink)"
        stroke="var(--accent-ink)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="3" y="25" width="26" height="2.2" rx="1.1" fill="var(--accent-ink)" />
    </svg>
  )
}

export default function Logo({ size = 'medium', showText = true, className = '' }: LogoProps) {
  return (
    <div className={`${styles.logoContainer} ${SIZE_CLASSES[size]} ${className}`.trim()}>
      <div className={styles.logoIconWrapper}>
        <LogoMark size={SVG_SIZES[size]} />
      </div>
      {showText && <h1 className={styles.logoText}>IozyPlay</h1>}
    </div>
  )
}
