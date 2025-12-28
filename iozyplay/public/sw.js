// Service Worker pour le cache offline
const CACHE_NAME = 'blindtest-v1'
const RUNTIME_CACHE = 'blindtest-runtime-v1'

// Assets à mettre en cache lors de l'installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
]

// Stratégie de cache : Cache First pour les assets statiques
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  
  if (cached) {
    return cached
  }
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    console.error('Cache first failed:', error)
    // Retourner une page offline si disponible
    const offlinePage = await cache.match('/offline.html')
    if (offlinePage) {
      return offlinePage
    }
    throw error
  }
}

// Stratégie de cache : Network First pour les API calls
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    console.error('Network first failed, trying cache:', error)
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching assets...')
      return cache.addAll(PRECACHE_ASSETS).catch((error) => {
        console.warn('[SW] Precaching failed:', error)
      })
    })
  )
  self.skipWaiting()
})

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Domaines publicitaires à bloquer
const AD_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'googleads.g.doubleclick.net',
  'adservice.google.com',
  'adservice.google.fr',
  'pagead2.googlesyndication.com',
  'tpc.googlesyndication.com',
  'www.googletagmanager.com',
  'www.google-analytics.com',
  'googleads.g.doubleclick.net',
  'pubads.g.doubleclick.net',
  'securepubads.g.doubleclick.net',
  'ads.youtube.com',
  'adclick.g.doubleclick.net'
]

// Patterns d'URLs publicitaires YouTube à bloquer
const AD_PATTERNS = [
  /\/api\/stats\/ads/,
  /\/pagead\//,
  /\/ads\//,
  /\/advertising\//,
  /\/get_ads/,
  /\/ptracking/,
  /\/log_event/,
  /\/videoplayback.*adformat=/,
  /\/videoplayback.*ad_/,
  /\/get_midroll/,
  /\/get_video_ads/
]

// Fonction pour vérifier si une URL est une publicité
function isAdRequest(url) {
  // Vérifier les domaines publicitaires
  if (AD_DOMAINS.some(domain => url.hostname.includes(domain))) {
    return true
  }

  // Vérifier les patterns d'URLs publicitaires
  if (AD_PATTERNS.some(pattern => pattern.test(url.pathname + url.search))) {
    return true
  }

  // Bloquer les requêtes vers googlevideo.com qui contiennent des paramètres publicitaires
  if (url.hostname.includes('googlevideo.com')) {
    const adParams = ['adformat', 'ad_', 'adformat=', 'ad_break', 'ad_slot']
    if (adParams.some(param => url.search.includes(param) || url.pathname.includes(param))) {
      return true
    }
  }

  return false
}

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Bloquer les requêtes publicitaires
  if (isAdRequest(url)) {
    console.log('[SW] Blocked ad request:', url.href)
    // Retourner une réponse vide pour bloquer la publicité
    event.respondWith(new Response(null, { status: 204, statusText: 'No Content' }))
    return
  }

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return
  }

  // Ignorer les requêtes Socket.io
  if (url.pathname.startsWith('/socket.io/')) {
    return
  }

  // Laisser passer les requêtes YouTube normales (embed, vidéo, etc.)
  // mais bloquer les publicités via isAdRequest() ci-dessus

  // Cache First pour les assets statiques (JS, CSS, images, fonts)
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.eot') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Network First pour les API calls
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/questions') ||
    url.pathname.startsWith('/categories')
  ) {
    event.respondWith(networkFirst(request))
    return
  }

  // Pour les autres requêtes (HTML, etc.), utiliser Network First
  event.respondWith(networkFirst(request))
})

// Gestion des messages depuis le client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls)
      })
    )
  }
})

