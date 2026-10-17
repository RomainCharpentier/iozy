import type { LucideIcon } from 'lucide-react'
import styles from '@/components/common/IconPill.module.scss'

/** Une icône Lucide dans une pastille ronde teintée à l'accent : l'ornement
 *  des cartes et des états vides. Jamais d'emoji dans le chrome de l'interface. */
export default function IconPill({
  icon: Icon,
  size = 'md',
}: {
  icon: LucideIcon
  size?: 'md' | 'lg'
}) {
  return (
    <span className={`${styles.pill} ${size === 'lg' ? styles.lg : ''}`.trim()} aria-hidden="true">
      <Icon size={size === 'lg' ? 26 : 22} />
    </span>
  )
}
