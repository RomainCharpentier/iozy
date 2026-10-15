import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import ds from '@/styles/shared/DesignSystem.module.scss'
import IconPill from '@/components/common/IconPill'
import styles from '@/components/common/EmptyState.module.scss'

/** Un écran qui n'a rien à montrer, et qui le dit avec une forme : une icône
 *  dans une pastille, un titre, la phrase qui donne la sortie, l'action s'il y
 *  en a une. La même forme partout. */
export default function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon: LucideIcon
  title: string
  detail?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className={`${ds.card} ${styles.empty}`}>
      <IconPill icon={icon} />
      <p className={styles.title}>{title}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
