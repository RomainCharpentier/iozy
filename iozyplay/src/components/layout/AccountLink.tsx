import { loginUrl, PROFILE_URL, useIozyAccount } from '@/lib/account/IozyAccount'

/**
 * Le lien de compte, le même sur chaque page du site : « Connexion » sans
 * compte Iozy, « Profil » avec (voir lib/account). La connexion ramène ici
 * une fois faite. Seule à la racine (dev, Vercel), l'app n'a pas d'IozyCore
 * à côté : rien.
 */
export default function AccountLink() {
  const account = useIozyAccount()
  if (import.meta.env.BASE_URL === '/') return null
  return account ? (
    <a className="iozy-compte" href={PROFILE_URL} title={`Mon profil — ${account.pseudo}`}>
      Profil
    </a>
  ) : (
    <a className="iozy-compte" href={loginUrl(window.location.pathname + window.location.search)}>
      Connexion
    </a>
  )
}
