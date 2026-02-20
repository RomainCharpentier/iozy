import styles from './Logo.module.scss'

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

export default function Logo({ size = 'medium', showText = true, className = '' }: LogoProps) {
  return (
    <div className={`${styles.logoContainer} ${SIZE_CLASSES[size]} ${className}`.trim()}>
      <div className={styles.logoIconWrapper}>
        <img
          src="/logo.svg"
          alt="No Peeking Logo"
          className={styles.logoImg}
          style={{ width: SVG_SIZES[size], height: SVG_SIZES[size] }}
          loading="lazy"
        />
      </div>
      {showText && <h1 className={styles.logoText}>No Peeking</h1>}
    </div>
  )
}
