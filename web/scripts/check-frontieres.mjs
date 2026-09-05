// Les frontières du rangement par page (Lot 134), vérifiées comme le contraste :
//   - `common` ne connaît aucune page ni l'app : ce qu'il contient est partagé,
//     il ne peut pas dépendre de qui le partage ;
//   - une page ne connaît pas une autre page : ce dont deux pages ont besoin
//     vit dans `common`. Une sous-page peut lire sa page mère, et une page ses
//     sous-pages - c'est le même écran.
// Un import est lu tel qu'il est écrit : alias `@/...` ou chemin relatif.
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

/** Le chemin d'un import, relatif à src et sans extension - ou null s'il vient de node_modules. */
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
      violations.push(`${relatif} : common ne peut pas dépendre de ${vers}`)
    }
    if (depuis.startsWith('pages/') && versPage.startsWith('pages/') && versPage !== depuis) {
      violations.push(`${relatif} : une page ne lit pas une autre page (${vers}) - ce qui est partagé va dans common`)
    }
  }
}

if (violations.length > 0) {
  console.error(`Frontières du front : ${violations.length} violation(s)`)
  for (const v of violations) console.error('  - ' + v)
  process.exit(1)
}
console.log('Frontières du front : common ne dépend d’aucune page, aucune page ne lit une autre page.')
