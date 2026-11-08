import { loginUrl, PROFILE_URL, useIozyAccount } from '@/lib/account/IozyAccount'
import { initialsOf } from '@/lib/account/initials'

/**
 * Le compte, le même sur chaque page du site : sans compte Iozy, le lien
 * « Connexion » ; avec, l'avatar de la barre du haut (les initiales, cerclées
 * de la couleur vive, classe `.iozy-avatar` d'IozyKit) qui mène au profil
 * d'IozyCore. La connexion ramène ici une fois faite. Seule à la racine (dev,
 * Vercel), l'app n'a pas d'IozyCore à côté : rien.
 */
export default function AccountLink() {
  const account = useIozyAccount()
  if (import.meta.env.BASE_URL === '/') return null
  return account ? (
    <a
      className="iozy-verre iozy-avatar"
      href={PROFILE_URL}
      title={`Mon profil — ${account.pseudo}`}
      aria-label={`Mon profil — ${account.pseudo}`}
    >
      {initialsOf(account.pseudo) || 'IO'}
    </a>
  ) : (
    <a className="iozy-compte" href={loginUrl(window.location.pathname + window.location.search)}>
      Connexion
    </a>
  )
}
