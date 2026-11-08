import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { IOZYTEST_ITEM, siteItemsPour } from '@/components/layout/navItems'
import { useIozyAccount } from '@/lib/account/IozyAccount'
import HeaderShortcuts from '@/components/layout/HeaderShortcuts'
import Wordmark from '@/components/layout/Wordmark'
import styles from '@/components/layout/AppShell.module.scss'

/** Servie sous /test à côté d'IozyCore ; seule à la racine (dev, Vercel),
 *  l'app n'a pas IozyCore à côté d'elle. */
const standalone = import.meta.env.BASE_URL === '/'

/**
 * La barre du haut (≥ 1024 px), celle de toutes les apps Iozy depuis la
 * refonte « plein cadre » (lot 210) : trois pièces de verre flottantes, dessinées
 * par les classes d'IozyKit (`.iozy-barre--eclatee`, `.iozy-verre`).
 * - la capsule : « Iozy », puis Accueil · Sorties · À acheter · Partager
 *   (des liens vers IozyCore) et IozyTest, la destination courante ;
 * - le champ « Chercher ou ajouter », qui cherche dans IozyCore ;
 * - les raccourcis (thème, éditeur, réglages) et l'avatar.
 * Seule à la racine, l'app garde sa marque et ses raccourcis, sans liens
 * vers une app qui n'est pas là.
 */
export default function DesktopHeader() {
  const connecte = useIozyAccount() !== null
  return (
    <header className={`iozy-barre iozy-barre--eclatee ${styles.header}`}>
      <div className="iozy-verre iozy-barre__pilule">
        {standalone ? (
          <Wordmark />
        ) : (
          <a href="/core/" className="iozy-barre__marque" aria-label="Iozy, accueil">
            Iozy
          </a>
        )}
        <nav className="iozy-barre__nav" aria-label="Navigation principale">
          {!standalone &&
            siteItemsPour(connecte).map(({ href, label }) => (
              <a key={href} href={href} className="iozy-barre__lien">
                {label}
              </a>
            ))}
          <Link to={IOZYTEST_ITEM.to} aria-current="page" className="iozy-barre__lien">
            {IOZYTEST_ITEM.label}
          </Link>
        </nav>
      </div>
      <div className="iozy-barre__espace" />
      {!standalone && (
        // Un formulaire GET simple : la recherche vit dans IozyCore, qui lit `q`.
        <form role="search" action="/core/add" method="get" className={`iozy-verre iozy-recherche ${styles.search}`}>
          <Search size={18} aria-hidden="true" />
          <input type="search" name="q" placeholder="Chercher ou ajouter" aria-label="Chercher ou ajouter" />
        </form>
      )}
      <HeaderShortcuts />
    </header>
  )
}
