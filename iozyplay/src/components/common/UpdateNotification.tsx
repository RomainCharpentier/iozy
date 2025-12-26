import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { FaSync } from 'react-icons/fa'

/**
 * Composant pour notifier l'utilisateur lorsqu'une mise à jour du service worker est disponible
 */
export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let refreshing = false

      // Écouter les changements de contrôle
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          window.location.reload()
        }
      })

      // Vérifier les mises à jour
      const checkForUpdates = () => {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (
                    newWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    // Nouveau service worker disponible
                    setUpdateAvailable(true)
                    toast(
                      (t) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FaSync />
                          <span>Une mise à jour est disponible</span>
                          <button
                            onClick={() => {
                              newWorker.postMessage({ type: 'SKIP_WAITING' })
                              toast.dismiss(t.id)
                            }}
                            style={{
                              background: '#6366f1',
                              color: 'white',
                              border: 'none',
                              padding: '4px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              marginLeft: '8px',
                            }}
                          >
                            Mettre à jour
                          </button>
                        </div>
                      ),
                      {
                        duration: Infinity,
                        icon: '🔄',
                      }
                    )
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


