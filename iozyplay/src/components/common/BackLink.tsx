import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import styles from '@/components/common/BackLink.module.scss'

/**
 * Le chemin du retour, en haut d'un écran forcément ouvert depuis ailleurs.
 * Le libellé NOMME la destination (« Jouer », « Réglages »), jamais « Retour »
 * tout court : un « Retour » sans destination ment une fois sur deux, et c'est
 * exactement ce que ferait `navigate(-1)`. 44 px de haut : c'est le premier
 * élément interactif de la page, visé au pouce en haut de l'écran.
 */
export default function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className={styles.link}>
      <ArrowLeft size={15} />
      {label}
    </Link>
  )
}
