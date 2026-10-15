import type { ReactNode } from 'react'
import styles from '@/components/common/SectionHeader.module.scss'

/**
 * L'en-tête d'un écran ou d'une grande section : un titre serré en Space
 * Grotesk, la phrase qui dit ce qu'on regarde, et l'action principale à
 * droite, alignée sur la LIGNE DE BASE du bloc titre (ni centrée, ni collée en
 * haut). Un seul `<h1>` par écran (`level={1}`), `<h2>` pour une section.
 *
 * Le sous-titre n'est pas décoratif : il dit quelque chose de vrai et de
 * calculé (« 3 thèmes sélectionnés sur 5 »), jamais un slogan — d'où un
 * ReactNode, pour y mettre un compteur ou un lien.
 */
export default function SectionHeader({
  title,
  subtitle,
  action,
  level = 2,
  className = '',
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  level?: 1 | 2
  className?: string
}) {
  const Title = level === 1 ? 'h1' : 'h2'
  return (
    <div className={`${styles.header} ${className}`.trim()}>
      <div className={styles.text}>
        <Title className={styles.title}>{title}</Title>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
