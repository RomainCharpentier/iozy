import { useEffect, useState } from 'react'

/**
 * Le lien de compte, le même partout dans la famille : « Connexion » sans
 * session IozyCore (une visite compte pour rien), « Profil » avec. Même site,
 * même cookie : l'API d'IozyCore répond 401 quand personne n'est connecté.
 * Seule à la racine (dev, Vercel), l'app n'a pas d'IozyCore à côté : rien.
 */
export default function AccountLink() {
  const standalone = import.meta.env.BASE_URL === '/'
  const [session, setSession] = useState<{ pseudo: string } | null | undefined>(undefined)

  useEffect(() => {
    if (standalone) return
    const controller = new AbortController()
    fetch('/api/auth/me', { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((compte) => setSession(compte && !compte.invite ? { pseudo: compte.pseudo } : null))
      .catch(() => setSession(null))
    return () => controller.abort()
  }, [standalone])

  if (standalone || session === undefined) return null
  return session ? (
    <a className="iozy-compte" href="/core/profile" title={`Mon profil — ${session.pseudo}`}>
      Profil
    </a>
  ) : (
    <a className="iozy-compte" href="/core/">
      Connexion
    </a>
  )
}
