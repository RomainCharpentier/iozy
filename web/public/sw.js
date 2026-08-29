/**
 * Le service worker d'IozyCore — la coquille de l'app, jamais ses données.
 *
 * ## Ce qu'il fait, et surtout ce qu'il ne fait pas
 * Il met en cache ce qui EST l'application : le document, les scripts, les
 * styles, les polices, les icônes. Il ne touche **jamais** à `/api` - ni pour
 * lire, ni pour écrire. Une collection servie depuis un cache serait une
 * collection périmée présentée comme la vraie, et le reste de l'app est
 * construit tout entier sur l'inverse : ne jamais afficher un chiffre auquel
 * on ne croit pas. Un backend éteint doit donc continuer de produire
 * l'erreur franche que `api/client.ts` traduit déjà en français.
 *
 * Sa raison d'être n'est pas le hors-ligne : c'est **l'installation**. Sans
 * service worker gérant `fetch`, un navigateur ne propose pas d'installer
 * l'app sur l'écran d'accueil - et une app de collection qu'on ne peut pas
 * ouvrir d'un pouce en brocante rate l'essentiel de son usage.
 *
 * ## Deux stratégies, selon ce que l'URL promet
 * Les fichiers de `/assets/` portent une empreinte dans leur nom : leur
 * contenu ne changera JAMAIS, donc le cache d'abord, sans condition. Tout le
 * reste - le document, le manifeste, les icônes - garde le réseau d'abord,
 * avec le cache en filet : c'est ce qui fait qu'un déploiement est visible à
 * la première visite suivante, et pas à la seconde.
 *
 * ## Testé
 * `strategiePour()` est une fonction pure, exportée sur `self` pour que
 * `src/sw.test.ts` l'exerce : c'est là que vivent les décisions, et une
 * erreur de tri y servirait silencieusement de vieilles données.
 */

const VERSION = 'iozycore-v1'

/** Ce qui ne passe jamais par ce service worker, quoi qu'il arrive. */
function horsPerimetre(url, methode) {
  if (methode !== 'GET') return true
  if (url.origin !== self.location.origin) return true
  // Les données de l'utilisateur : lues au réseau, ou pas du tout.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return true
  return false
}

/**
 * @returns {'ignorer'|'cache-dabord'|'reseau-dabord'}
 */
function strategiePour(url, methode = 'GET') {
  if (horsPerimetre(url, methode)) return 'ignorer'
  // Nom empreinté par le build : le contenu est immuable, le cache fait foi.
  if (url.pathname.startsWith('/assets/')) return 'cache-dabord'
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
    // Une navigation sans réseau ni cache exact : le document d'accueil fait
    // office de coquille, le routeur reprend la main côté client.
    if (requete.mode === 'navigate') {
      const accueil = await cache.match('/')
      if (accueil) return accueil
    }
    throw panne
  }
}

self.addEventListener('install', (evenement) => {
  // La coquille minimale, pour qu'une première visite hors ligne ait au moins
  // un document à rendre. Le reste se met en cache à l'usage.
  evenement.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evenement) => {
  // Les caches des versions précédentes ne servent plus à rien : les garder
  // ferait grossir le stockage du téléphone sans jamais rien resservir.
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
