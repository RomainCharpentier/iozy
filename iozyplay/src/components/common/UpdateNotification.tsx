import { useEffect, useState } from 'react'
import { toast } from 'sonner'

/**
 * Composant pour notifier l'utilisateur lorsqu'une mise à jour du service worker est disponible
 */
export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Le rechargement quand un nouveau worker prend le contrôle est géré à
      // un seul endroit, utils/serviceWorker.ts : un second écouteur ici
      // rechargeait sans condition, donc aussi à la toute première visite.

      // Vérifier les mises à jour
      const checkForUpdates = () => {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Nouveau service worker disponible
                    setUpdateAvailable(true)
                    toast('Une mise à jour est disponible', {
                      duration: Infinity,
                      icon: '🔄',
                      action: {
                        label: 'Mettre à jour',
                        onClick: () => {
                          newWorker.postMessage({ type: 'SKIP_WAITING' })
                          window.location.reload()
                        },
                      },
                    })
                  }
                })
              }
            })

            // Vérifier immédiatement
            registration.update()
          }
        })
      }

      // Vérifier les mises à jour au chargement
      checkForUpdates()

      // Vérifier périodiquement (toutes les 5 minutes)
      const interval = setInterval(checkForUpdates, 5 * 60 * 1000)

      return () => {
        clearInterval(interval)
      }
    }
  }, [])

  return null
}
