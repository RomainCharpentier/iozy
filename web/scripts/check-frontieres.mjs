// The boundaries of the per-page layout (Batch 134), checked like the contrast:
//   - `common` knows no page and not the app: what it contains is shared,
//     it cannot depend on whoever shares it;
//   - a page does not know another page: what two pages need lives in
//     `common`. A subpage may read its parent page, and a page its
//     subpages - it is the same screen.
// An import is read as it is written: `@/...` alias or relative path.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
const SPEC = /(?:from\s+|import\s*\(\s*|vi\.mock\(\s*|importActual\(\s*|import\s+)['"]([^'"]+)['"]/g

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

/** The path of an import, relative to src and without extension - or null if it comes from node_modules. */
function cible(fichier, spec) {
  if (spec.startsWith('@/')) return spec.slice(2)
  if (spec.startsWith('.')) return relative(SRC, resolve(dirname(fichier), spec)).replaceAll('\\', '/')
  return null
}

/** `pages/entity/apercu/ApercuOeuvrePage.tsx` -> `entity` ; `common/...` -> `common` ; `app/...` -> `app`. */
function page(chemin) {
  const parts = chemin.split('/')
  if (parts[0] === 'pages') return `pages/${parts[1]}`
  return parts[0]
}

const violations = []
for (const fichier of fichiers(SRC)) {
  const relatif = relative(SRC, fichier).replaceAll('\\', '/')
  const depuis = page(relatif)
  const texte = readFileSync(fichier, 'utf8')
  for (const [, spec] of texte.matchAll(SPEC)) {
    const vers = cible(fichier, spec)
    if (vers === null) continue
    const versPage = page(vers)
    if (depuis === 'common' && (versPage.startsWith('pages/') || versPage === 'app')) {
      violations.push(`${relatif} : common cannot depend on ${vers}`)
    }
    if (depuis.startsWith('pages/') && versPage.startsWith('pages/') && versPage !== depuis) {
      violations.push(`${relatif} : a page does not read another page (${vers}) - what is shared goes in common`)
    }
  }
}

if (violations.length > 0) {
  console.error(`Front boundaries: ${violations.length} violation(s)`)
  for (const v of violations) console.error('  - ' + v)
  process.exit(1)
}
console.log('Front boundaries: common depends on no page, no page reads another page.')
