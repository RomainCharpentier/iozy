import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Génère css/tokens.css depuis tokens.json : une propriété `--iozy-<rôle>` par
 * valeur, le thème clair sur `:root` (et les sélecteurs explicites des deux
 * apps), le thème sombre sur les sélecteurs sombres des deux apps.
 *
 * Pourquoi deux conventions de sélecteur : IozyCore pose `data-theme="dark"`
 * sur <html>, IozyPlay pose les classes `.dark-theme` / `.light-theme`. Le CSS
 * généré sert les deux sans qu'aucune ne change sa mécanique de bascule.
 */
const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const tokens = JSON.parse(readFileSync(join(racine, 'tokens.json'), 'utf8'))

const ligne = (nom, valeur) => `  --iozy-${nom}: ${valeur};`
const bloc = (selecteurs, lignes) => `${selecteurs} {\n${lignes.join('\n')}\n}\n`

const statiques = [
  ...Object.entries(tokens.fonts)
    .filter(([k]) => k !== 'packages')
    .map(([k, v]) => ligne(`font-${k}`, v)),
  ...Object.entries(tokens.radius).map(([k, v]) => ligne(`radius-${k}`, v)),
  ...Object.entries(tokens.size).map(([k, v]) => ligne(k, v)),
]

const theme = (nom) => Object.entries(tokens.themes[nom]).map(([k, v]) => ligne(k, v))

const css = [
  '/* Généré par scripts/build-css.mjs depuis tokens.json — ne pas modifier à la main. */',
  '',
  bloc(':root', statiques),
  bloc(":root,\n.light-theme,\n[data-theme='light']", theme('light')),
  bloc(".dark-theme,\n[data-theme='dark']", theme('dark')),
].join('\n')

mkdirSync(join(racine, 'css'), { recursive: true })
writeFileSync(join(racine, 'css', 'tokens.css'), css)
console.log(`css/tokens.css écrit (${Object.keys(tokens.themes.light).length} rôles × 2 thèmes).`)
