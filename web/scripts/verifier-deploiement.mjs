/**
 * Vérifie qu'une mise en ligne **tient ses promesses**, depuis l'extérieur.
 *
 * Usage : `node scripts/verifier-deploiement.mjs https://iozycore.vercel.app`
 *
 * ## Ce qu'il attrape, et pourquoi ça ne se voit pas autrement
 * Toutes les erreurs contrôlées ici produisent une app qui **a l'air de
 * marcher** :
 *
 * - la réécriture `/api/*` mal orthographiée dans `vercel.json` : l'écran de
 *   connexion s'affiche quand même, il attend juste une réponse qui ne vient
 *   pas ;
 * - la porte grande ouverte (un `permitAll` de trop) : personne ne s'en plaint,
 *   tout le monde voit tout ;
 * - le lien de partage qui répond 401 au lieu de 404 : c'est le défaut réel
 *   trouvé au Lot 94 (la redirection interne d'erreur retraversait la chaîne de
 *   sécurité), et il ne se voyait que sur un vrai serveur ;
 * - le manifeste servi en `application/json` : l'invite d'installation
 *   disparaît, sans un message ;
 * - `sw.js` mis en cache par le CDN : les visiteurs restent sur l'ancienne
 *   version, parfois des jours.
 *
 * `check-pwa.mjs` vérifie les mêmes fichiers **sur le disque** ; celui-ci
 * vérifie ce que le serveur en fait. Les deux sont nécessaires : le second ne
 * peut pas tourner avant qu'une adresse existe.
 *
 * ## Il ne crée rien, et n'a besoin d'aucun compte
 * Uniquement des GET sur des routes ouvertes ou censées refuser. Il peut donc
 * se lancer sur une mise en ligne réelle, à tout moment, sans rien y laisser.
 */

const adresse = process.argv[2]
if (!adresse) {
  console.error('Usage : node scripts/verifier-deploiement.mjs <url-de-lapp>')
  console.error('Exemple : node scripts/verifier-deploiement.mjs https://iozycore.vercel.app')
  process.exit(2)
}

const base = adresse.replace(/\/+$/, '')
const problemes = []
const reussites = []

function verifier(condition, message, detail) {
  if (condition) reussites.push(message)
  else problemes.push(detail ? `${message} — ${detail}` : message)
}

/** Jamais de redirection suivie : une 30x sur ces routes EST le défaut à voir. */
async function demander(chemin) {
  return fetch(`${base}${chemin}`, { redirect: 'manual', headers: { Accept: '*/*' } })
}

// --- 1. La réécriture /api/* atteint bien l'API
//
//     `/api/auth/etat` est l'une des trois routes ouvertes : elle répond sans
//     compte, et son corps prouve que c'est bien Spring qui a répondu et non la
//     page d'accueil renvoyée par le repli SPA (le piège classique d'une
//     réécriture absente : 200, du HTML, et tout a l'air normal).
try {
  const etat = await demander('/api/auth/etat')
  verifier(etat.status === 200, "/api/auth/etat répond 200", `reçu ${etat.status}`)
  const type = etat.headers.get('content-type') ?? ''
  verifier(type.includes('application/json'), '/api/auth/etat répond du JSON', `content-type : ${type || 'absent'}`)
  if (type.includes('application/json')) {
    const corps = await etat.json()
    verifier(
      typeof corps.aucunCompte === 'boolean' && typeof corps.creationOuverte === 'boolean',
      "l'état d'authentification a la forme attendue",
      `reçu ${JSON.stringify(corps)}`,
    )
  }
} catch (cause) {
  problemes.push(`/api/auth/etat injoignable — ${cause.message}`)
}

// --- 2. La porte est fermée
//
//     401 et pas 200 (la collection de quelqu'un ne se lit pas sans session),
//     mais pas 404 non plus : un 404 ici voudrait dire que la réécriture ne
//     couvre pas toutes les routes, et le défaut ne se verrait qu'une fois
//     connecté.
try {
  const protegee = await demander('/api/entities/search')
  verifier(protegee.status === 401, '/api/entities/search refuse en 401 sans session', `reçu ${protegee.status}`)
} catch (cause) {
  problemes.push(`/api/entities/search injoignable — ${cause.message}`)
}

// --- 3. Le lien de partage reste ouvert, et dit vrai
//
//     Un jeton inventé doit donner 404 « ce lien n'existe pas », jamais 401 :
//     son destinataire n'a pas de compte, et un 401 lui demanderait de se
//     connecter pour voir une collection qui n'est pas la sienne.
try {
  const partage = await demander(`/api/public/share/jeton-inexistant-${Date.now()}`)
  verifier(
    partage.status === 404,
    'un lien de partage inconnu répond 404 (et non 401)',
    `reçu ${partage.status}${partage.status === 401 ? " — la redirection interne d'erreur retraverse la sécurité" : ''}`,
  )
} catch (cause) {
  problemes.push(`/api/public/share injoignable — ${cause.message}`)
}

// --- 4. L'app est installable telle qu'elle est SERVIE
//
//     Le type MIME du manifeste ne vient pas du fichier mais du serveur, et
//     c'est exactement là qu'il se perd : nginx ne connaît pas l'extension
//     `.webmanifest` par défaut.
try {
  const manifeste = await demander('/manifest.webmanifest')
  verifier(manifeste.status === 200, '/manifest.webmanifest est servi', `reçu ${manifeste.status}`)
  const type = manifeste.headers.get('content-type') ?? ''
  verifier(
    type.includes('application/manifest+json'),
    'le manifeste est servi en application/manifest+json',
    `content-type : ${type || 'absent'}`,
  )
} catch (cause) {
  problemes.push(`/manifest.webmanifest injoignable — ${cause.message}`)
}

// --- 5. Le service worker n'est pas figé
//
//     Un `sw.js` mis en cache par un intermédiaire gèle l'application chez les
//     visiteurs : ils gardent l'ancienne coquille jusqu'à expiration, sans
//     aucun moyen de le savoir ni de forcer la mise à jour.
try {
  const sw = await demander('/sw.js')
  verifier(sw.status === 200, '/sw.js est servi', `reçu ${sw.status}`)
  const cache = sw.headers.get('cache-control') ?? ''
  verifier(
    /no-cache|no-store|max-age=0/.test(cache),
    'sw.js interdit la mise en cache',
    `cache-control : ${cache || 'absent'}`,
  )
} catch (cause) {
  problemes.push(`/sw.js injoignable — ${cause.message}`)
}

// --- 6. Une route profonde ne tombe pas en 404
//
//     Un rechargement sur `/tier-lists` doit rendre la coquille de l'app : sans
//     repli SPA, l'app marche tant qu'on navigue et casse au premier F5 ou au
//     premier lien partagé.
try {
  const profonde = await demander('/tier-lists')
  verifier(profonde.status === 200, '/tier-lists rend la coquille (repli SPA)', `reçu ${profonde.status}`)
  const type = profonde.headers.get('content-type') ?? ''
  verifier(type.includes('text/html'), '/tier-lists rend du HTML', `content-type : ${type || 'absent'}`)
} catch (cause) {
  problemes.push(`/tier-lists injoignable — ${cause.message}`)
}

// --- 7. Le cookie anti-CSRF, quand il y a du TLS
//
//     Contrôlé seulement en HTTPS : en local, `Secure` empêcherait le cookie
//     d'être posé du tout, et son absence est alors normale.
if (base.startsWith('https://')) {
  try {
    const etat = await demander('/api/auth/etat')
    const cookies = etat.headers.getSetCookie?.() ?? []
    const csrf = cookies.find((c) => c.startsWith('XSRF-TOKEN='))
    if (csrf) {
      verifier(/;\s*Secure/i.test(csrf), 'le cookie XSRF-TOKEN est Secure', csrf)
    }
  } catch {
    // L'échec a déjà été signalé au point 1 : ne pas le compter deux fois.
  }
}

console.log(`Vérification de ${base}`)
for (const reussite of reussites) console.log(`  ok   ${reussite}`)
for (const probleme of problemes) console.error(`  KO   ${probleme}`)

if (problemes.length > 0) {
  console.error(`\n${problemes.length} problème(s) sur ${problemes.length + reussites.length} contrôles.`)
  process.exit(1)
}
console.log(`\n${reussites.length} contrôles, aucun problème.`)
