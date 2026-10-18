// Utilitaire pour gérer l'enregistrement du service worker

// Détecter si on est en mode développement
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

// Au plus un rechargement automatique par onglet et par minute (voir plus bas).
const RELOAD_KEY = 'iozyplay.sw-reload'
const RELOAD_MIN_INTERVAL_MS = 60_000

function lastAutomaticReload(): number {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
  } catch {
    return 0
  }
}

function rememberAutomaticReload() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Stockage refusé : on recharge quand même, le drapeau en mémoire suffit.
  }
}

export function registerServiceWorker() {
  // Ne pas enregistrer le service worker en développement pour éviter les problèmes de cache
  if (isDevelopment) {
    console.log('[SW] Development mode: Service Worker disabled to avoid cache issues')

    // Désinscrire le service worker s'il existe déjà et vider tous les caches
    if ('serviceWorker' in navigator) {
      // Désinscrire tous les service workers
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const unregisterPromises = registrations.map((registration) => {
          return registration.unregister().then((success) => {
            if (success) {
              console.log('[SW] Unregistered service worker:', registration.scope)
            }
            return success
          })
        })

        Promise.all(unregisterPromises).then(() => {
          // Vider tous les caches
          if ('caches' in window) {
            ;(window.caches as CacheStorage).keys().then((cacheNames) => {
              const deletePromises = cacheNames.map((cacheName) => {
                return (window.caches as CacheStorage).delete(cacheName).then((success) => {
                  if (success) {
                    console.log('[SW] Deleted cache:', cacheName)
                  }
                  return success
                })
              })

              Promise.all(deletePromises).then(() => {
                console.log('[SW] All caches cleared')
              })
            })
          }
        })
      })
    }
    return
  }

  if ('serviceWorker' in navigator) {
    // Le worker qui contrôlait la page à l'arrivée, s'il est le nôtre. Un
    // worker d'une autre portée (l'ancien worker d'IozyCore inscrit à la
    // racine du site) ne compte pas : le remplacer ne change rien à l'écran.
    const scope = new URL(import.meta.env.BASE_URL, window.location.origin).href
    const previous = navigator.serviceWorker.controller
    const hadOurController = !!previous && previous.scriptURL.startsWith(scope)
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .then((registration) => {
          console.log('[SW] Service Worker registered:', registration.scope)

          // Vérifier les mises à jour périodiquement
          setInterval(() => {
            registration.update()
          }, 60000) // Vérifier toutes les minutes

          // Écouter les mises à jour
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nouveau service worker disponible
                  console.log('[SW] New service worker available')
                  // Optionnel : notifier l'utilisateur pour recharger la page
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[SW] Service Worker registration failed:', error)
        })

      // Sous un préfixe, l'ancien worker d'IozyCore resté inscrit à la racine
      // du site intercepte encore cette page et ne peut plus se mettre à jour
      // (son script a déménagé) : on le désinscrit. À la racine, cette portée
      // est la nôtre.
      if (import.meta.env.BASE_URL !== '/') {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            for (const registration of registrations) {
              if (registration.scope === `${window.location.origin}/`) registration.unregister()
            }
          })
          .catch(() => {})
      }

      // Écouter les messages du service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[SW] Message from service worker:', event.data)
      })

      // Recharger seulement quand un worker en REMPLACE le nôtre : c'est la
      // mise à jour qui s'applique. Au premier contrôle (installation, page
      // contrôlée par rien ou par un worker d'une autre portée), rien ne
      // change à l'écran. Et jamais plus d'une fois par minute dans un onglet :
      // quelle qu'en soit la cause (worker réinstallé à chaque chargement,
      // « Update on reload » des outils de développement), une page qui
      // recharge sans fin est pire qu'une page en retard d'une version.
      // C'est le seul écouteur de ce genre : UpdateNotification s'y fie.
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadOurController || refreshing) return
        if (Date.now() - lastAutomaticReload() < RELOAD_MIN_INTERVAL_MS) {
          console.log('[SW] New service worker activated, already reloaded a moment ago: not again')
          return
        }
        refreshing = true
        rememberAutomaticReload()
        console.log('[SW] New service worker activated, reloading...')
        window.location.reload()
      })
    })
  } else {
    console.warn('[SW] Service Workers are not supported in this browser')
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister()
    })
  }
}
