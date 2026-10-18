import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { settingsService } from '@/services/settingsService'

/**
 * Le compte Iozy, un seul pour tout le site : celui d'IozyCore. Même site,
 * même cookie, l'API d'IozyCore dit qui est connecté (401 sinon, et une
 * visite sans compte compte pour rien). Quand il y a un compte, son pseudo
 * EST le nom de joueur : plus d'écran « ton nom », plus de nom à retaper.
 * Sans compte, les invités gardent le nom libre, enregistré sur l'appareil.
 *
 * Seule à la racine (dev, Vercel), l'app n'a pas d'IozyCore à côté : personne.
 * Et IozyCore injoignable ne bloque jamais IozyPlay : au pire, pas de compte.
 */
export interface IozyAccount {
  pseudo: string
}

/** La longueur maximale d'un nom de joueur (voir UsernamePage). */
const MAX_PLAYER_NAME = 20
const ACCOUNT_TIMEOUT_MS = 3000

function standalone(): boolean {
  return import.meta.env.BASE_URL === '/'
}

/** Le compte connecté, ou null : sans compte, en visite, hors site, ou IozyCore muet. */
export async function fetchIozyAccount(): Promise<IozyAccount | null> {
  if (standalone()) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ACCOUNT_TIMEOUT_MS)
  try {
    const response = await fetch('/api/auth/me', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return null
    const compte = (await response.json()) as { pseudo?: unknown; invite?: unknown }
    if (compte.invite || typeof compte.pseudo !== 'string' || !compte.pseudo.trim()) return null
    return { pseudo: compte.pseudo.trim() }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Le pseudo du compte devient le nom de joueur enregistré, s'il ne l'est pas déjà. */
export function adoptAccountName(pseudo: string): string {
  const name = pseudo.trim().slice(0, MAX_PLAYER_NAME)
  const settings = settingsService.getSettings()
  if (settings.username !== name || !settings.usernameFromAccount) {
    settingsService.saveSettings({ username: name, usernameFromAccount: true })
  }
  return name
}

/**
 * Plus de compte : un nom qui venait d'un compte part avec lui, la porte
 * redemandera un nom. Un nom choisi par un invité reste, c'est le sien.
 */
export function dropAccountName(): void {
  if (settingsService.getSetting('usernameFromAccount')) {
    settingsService.saveSettings({ username: '', usernameFromAccount: false })
  }
}

/** La porte d'IozyCore, qui ramène ici une fois connecté (`next` : un chemin du site). */
export function loginUrl(returnTo: string): string {
  return `/core/?next=${encodeURIComponent(returnTo)}`
}

/** Le profil du compte, sur IozyCore : c'est là que le pseudo se change. */
export const PROFILE_URL = '/core/profile'

const IozyAccountContext = createContext<IozyAccount | null>(null)

/**
 * Demande une fois qui est connecté, adopte son pseudo, puis monte l'app :
 * un aller-retour au plus, et tout l'arbre lit le bon nom d'emblée.
 */
export function IozyAccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<IozyAccount | null | undefined>(() => (standalone() ? null : undefined))

  useEffect(() => {
    if (account !== undefined) return
    let alive = true
    fetchIozyAccount().then((found) => {
      if (!alive) return
      if (found) adoptAccountName(found.pseudo)
      else dropAccountName()
      setAccount(found)
    })
    return () => {
      alive = false
    }
  }, [account])

  if (account === undefined) return null
  return <IozyAccountContext.Provider value={account}>{children}</IozyAccountContext.Provider>
}

/** Le compte Iozy connecté, ou null. */
export function useIozyAccount(): IozyAccount | null {
  return useContext(IozyAccountContext)
}
