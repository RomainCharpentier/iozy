import { Link } from 'react-router-dom'
import styles from '@/components/layout/AppShell.module.scss'

/** Le nom de l'app en texte, « Iozy » en encre et « Play » en accent — même
 *  construction que « Iozycore » dans l'en-tête d'IozyCore. */
export default function Wordmark() {
  return (
    <Link to="/" className={styles.wordmark} aria-label="IozyPlay — accueil">
      Iozy<span className={styles.wordmarkAccent}>Play</span>
    </Link>
  )
}
