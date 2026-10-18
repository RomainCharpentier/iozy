/**
 * The IozyCore service worker — the shell of the app, never its data.
 *
 * ## What it does, and above all what it does not do
 * It caches what IS the application: the document, the scripts, the styles,
 * the fonts, the icons. It **never** touches `/api` - neither to read nor to
 * write. A collection served from a cache would be a stale collection passed
 * off as the real one, and the rest of the app is built entirely on the
 * opposite: never show a number we do not believe. A stopped backend must
 * therefore keep producing the plain error that `api/client.ts` already
 * translates into French.
 *
 * Its purpose is not offline use: it is **installation**. Without a service
 * worker handling `fetch`, a browser does not offer to install the app on the
 * home screen - and a collection app that cannot be opened with one thumb at
 * a flea market misses most of its use.
 *
 * ## Two strategies, depending on what the URL promises
 * The files in `/assets/` carry a hash in their name: their content will
 * NEVER change, so cache first, unconditionally. Everything else - the
 * document, the manifest, the icons - keeps network first, with the cache as
 * a safety net: this is why a deployment is visible on the next visit, and
 * not on the second one.
 *
 * ## Tested
 * `strategiePour()` is a pure function, exported on `self` so that
 * `src/sw.test.ts` can exercise it: this is where the decisions live, and a
 * sorting mistake there would silently serve old data.
 */

const VERSION = 'iozycore-v1'

// The path the app is served under ('/' or '/core/'): the one of this script.
// Everything of the app shell is read relative to it; /api stays at the root.
const BASE = new URL('./', self.location.href).pathname

/** What never goes through this service worker, whatever happens. */
function horsPerimetre(url, methode) {
  if (methode !== 'GET') return true
  if (url.origin !== self.location.origin) return true
  // The user's data: read from the network, or not at all.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return true
  return false
}

/**
 * @returns {'ignorer'|'cache-dabord'|'reseau-dabord'}
 */
function strategiePour(url, methode = 'GET') {
  if (horsPerimetre(url, methode)) return 'ignorer'
  // Name hashed by the build: the content is immutable, the cache is trusted.
  if (url.pathname.startsWith(BASE + 'assets/')) return 'cache-dabord'
  return 'reseau-dabord'
}

self.strategiePour = strategiePour

async function cacheDabord(requete) {
  const cache = await caches.open(VERSION)
  const enCache = await cache.match(requete)
  if (enCache) return enCache
  const reponse = await fetch(requete)
  if (reponse.ok) cache.put(requete, reponse.clone())
  return reponse
}

async function reseauDabord(requete) {
  const cache = await caches.open(VERSION)
  try {
    const reponse = await fetch(requete)
    if (reponse.ok) cache.put(requete, reponse.clone())
    return reponse
  } catch (panne) {
    const enCache = await cache.match(requete)
    if (enCache) return enCache
    // A navigation with no network and no exact cache entry: the home
    // document acts as the shell, and the router takes over on the client.
    if (requete.mode === 'navigate') {
      const accueil = await cache.match(BASE)
      if (accueil) return accueil
    }
    throw panne
  }
}

self.addEventListener('install', (evenement) => {
  // The minimal shell, so that a first offline visit has at least one
  // document to render. The rest is cached as it is used.
  evenement.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([BASE, BASE + 'manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evenement) => {
  // The caches of previous versions are useless: keeping them would grow the
  // phone storage without ever serving anything again.
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((nom) => nom !== VERSION).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request
  const strategie = strategiePour(new URL(requete.url), requete.method)
  if (strategie === 'ignorer') return
  evenement.respondWith(strategie === 'cache-dabord' ? cacheDabord(requete) : reseauDabord(requete))
})
