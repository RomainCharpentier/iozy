import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Copie la charte IozyKit dans vendor/iozykit/ (`npm run kit:sync`).
 *
 * Pourquoi une copie et non une dépendance : le déploiement (Vercel) ne voit
 * pas un dossier voisin, et un `file:../IozyKit` casserait l'installation là-bas.
 * La copie est suivie par git ; VERSION note le commit du kit qu'elle reflète,
 * pour savoir qui est en retard. Le kit reste la source de vérité : on ne
 * modifie jamais vendor/iozykit/ à la main.
 */
const source = path.resolve(process.env.IOZYKIT_PATH ?? path.join('..', 'IozyKit'))
if (!existsSync(path.join(source, 'tokens.json'))) {
  console.error(`IozyKit introuvable dans ${source} (indiquer IOZYKIT_PATH=…).`)
  process.exit(1)
}

// Le CSS des tokens est généré : on le régénère pour ne jamais copier un
// tokens.css en retard sur tokens.json.
execSync('node scripts/build-css.mjs', { cwd: source, stdio: 'inherit' })

const cible = path.resolve('vendor', 'iozykit')
mkdirSync(cible, { recursive: true })
cpSync(path.join(source, 'css'), path.join(cible, 'css'), { recursive: true })
cpSync(path.join(source, 'tokens.json'), path.join(cible, 'tokens.json'))

let ref = 'inconnu'
try {
  ref = execSync('git rev-parse --short HEAD', { cwd: source }).toString().trim()
} catch {
  // Pas de git côté kit : on note seulement la date.
}
writeFileSync(path.join(cible, 'VERSION'), `${ref} ${new Date().toISOString().slice(0, 10)}\n`)
console.log(`IozyKit ${ref} copié dans vendor/iozykit/`)
