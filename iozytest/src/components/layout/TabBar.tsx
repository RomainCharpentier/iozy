import { Link } from 'react-router-dom'
import { IOZYTEST_ITEM, siteItemsPour } from '@/components/layout/navItems'
import { useIozyAccount } from '@/lib/account/IozyAccount'
import styles from '@/components/layout/AppShell.module.scss'

const standalone = import.meta.env.BASE_URL === '/'

/** Barre au pouce (< 1024 px) : la capsule de verre d'IozyKit
 *  (`.iozy-onglets`), avec les mêmes destinations que la barre du haut.
 *  Seule à la racine, l'app n'en a pas d'autre qu'elle-même. */
export default function TabBar() {
  const Icone = IOZYTEST_ITEM.icon
  const connecte = useIozyAccount() !== null
  return (
    <nav className={`iozy-verre iozy-onglets ${styles.tabBar}`} aria-label="Navigation principale">
      {!standalone &&
        siteItemsPour(connecte).map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className="iozy-onglets__onglet">
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      <Link to={IOZYTEST_ITEM.to} aria-current="page" className="iozy-onglets__onglet">
        <Icone size={20} strokeWidth={2.15} aria-hidden="true" />
        <span>{IOZYTEST_ITEM.label}</span>
      </Link>
    </nav>
  )
}
