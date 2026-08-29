/**
 * Vérifie que l'app est réellement installable — et le reste.
 *
 * ## Pourquoi un script plutôt qu'un test Vitest
 * Ce contrôle lit des FICHIERS : le manifeste et les PNG de `public/`, dont il
 * relit les dimensions dans l'en-tête. Les tests de ce dépôt vivent dans `src`,
 * où le typage n'expose délibérément pas les modules de Node - ouvrir `node:fs`
 * à `src` pour un seul test permettrait surtout d'en importer par accident dans
 * du code de navigateur. Même parti pris que `check-contrast.mjs`, et même
 * absence de dépendance.
 *
 * ## Ce qu'il attrape
 * Une installation ratée ne produit **aucun message** : le navigateur retire
 * simplement l'invite. Une icône déclarée mais absente, une taille qui ne
 * correspond pas à son fichier, un `display` retombé sur `browser`, et l'app
 * cesse d'être installable sans qu'un seul écran ne change d'aspect.
 *
 * Le manifeste et les icônes étant générés par `make-icons.mjs`, ce script
 * vérifie l'accord entre ce qui est PROMIS et ce qui est réellement sur le
 * disque - c'est le seul endroit où la promesse peut se décoller du fichier.
 *
 * Usage : `npm run check:pwa`
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const problemes = []

function verifier(condition, message) {
  if (!condition) problemes.push(message)
}

let manifeste
try {
  manifeste = JSON.parse(readFileSync(join(racine, 'manifest.webmanifest'), 'utf8'))
} catch (cause) {
  console.error(`manifest.webmanifest illisible : ${cause.message}`)
  console.error('Lance `npm run icons` pour le régénérer.')
  process.exit(1)
}

// --- Ce qu'un navigateur exige avant de proposer l'installation
verifier(typeof manifeste.name === 'string' && manifeste.name.length > 0, 'name manquant')
verifier(typeof manifeste.short_name === 'string' && manifeste.short_name.length > 0, 'short_name manquant')
verifier(manifeste.start_url === '/', `start_url doit être "/" (lu : ${manifeste.start_url})`)
verifier(
  ['standalone', 'fullscreen', 'minimal-ui'].includes(manifeste.display),
  `display "${manifeste.display}" ne rend pas l'app installable`,
)
// Posées par le système avant le premier octet de CSS.
verifier(/^#[0-9a-f]{6}$/i.test(manifeste.background_color ?? ''), 'background_color absent ou mal formé')
verifier(/^#[0-9a-f]{6}$/i.test(manifeste.theme_color ?? ''), 'theme_color absent ou mal formé')
verifier(manifeste.lang === 'fr', "lang doit valoir \"fr\" - l'app est entièrement en français")

// --- Les icônes promises existent-elles, à la taille annoncée ?
const icones = Array.isArray(manifeste.icons) ? manifeste.icons : []
verifier(icones.length > 0, 'aucune icône déclarée')

for (const icone of icones) {
  const chemin = join(racine, icone.src.replace(/^\//, ''))
  let octets
  try {
    octets = readFileSync(chemin)
  } catch {
    problemes.push(`${icone.src} est déclarée dans le manifeste mais absente de public/`)
    continue
  }
  if (octets.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    problemes.push(`${icone.src} n'est pas un PNG`)
    continue
  }
  // Dimensions relues dans l'en-tête IHDR, jamais déduites du nom de fichier.
  const reelles = `${octets.readUInt32BE(16)}x${octets.readUInt32BE(20)}`
  verifier(reelles === icone.sizes, `${icone.src} annonce ${icone.sizes} et mesure ${reelles}`)
}

const tailles = icones.map((i) => i.sizes)
verifier(tailles.includes('192x192'), 'icône 192x192 manquante (exigée pour l’installation)')
verifier(tailles.includes('512x512'), 'icône 512x512 manquante (exigée pour l’installation)')
// Une maskable seule serait rognée partout ; une « any » seule flotterait dans
// un cercle de lanceur Android. Il faut les deux.
verifier(
  icones.some((i) => i.purpose === 'maskable'),
  'aucune icône « maskable » : les lanceurs Android rogneront le dessin',
)
verifier(
  icones.some((i) => i.purpose === 'any'),
  'aucune icône « any » : une maskable seule serait rognée partout',
)

// --- Le service worker, sans lequel aucune invite d'installation n'apparaît
try {
  const sw = readFileSync(join(racine, 'sw.js'), 'utf8')
  verifier(/addEventListener\(\s*'fetch'/.test(sw), "sw.js n'écoute pas `fetch` : pas d'invite d'installation")
} catch {
  problemes.push('sw.js absent de public/')
}

if (problemes.length > 0) {
  console.error(`Installabilité : ${problemes.length} problème(s).`)
  for (const probleme of problemes) console.error(`  - ${probleme}`)
  process.exit(1)
}

console.log(
  `Installabilité : manifeste valide, ${icones.length} icônes présentes et aux dimensions annoncées, service worker en place.`,
)
