import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Vérifie WCAG AA (4,5:1) sur toutes les paires qui comptent, dans les deux
 * thèmes, depuis tokens.json. Échoue (code 1) à la première paire en dessous.
 *
 * Trois familles de paires, parce que ce sont les trois erreurs qu'on fait :
 * - un texte sur les TROIS fonds du thème (pas seulement le plus contrasté) ;
 * - une encre SUR son aplat (bouton primaire, badge plein) ;
 * - un texte d'état sur sa teinte, elle-même posée sur chaque fond.
 */
const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const { themes } = JSON.parse(readFileSync(join(racine, 'tokens.json'), 'utf8'))

const SEUIL = 4.5
const FONDS = ['bg', 'surface', 'surface2']
const TEXTES = ['text', 'text-dim', 'text-muted', 'text-faint', 'accent-text', 'danger-text', 'ok', 'warn', 'info']
const ENCRES = [
  ['accent-ink', 'accent'],
  ['ok-ink', 'ok'],
  ['warn-ink', 'warn'],
  ['danger-ink', 'danger'],
]
const TEINTES = [
  ['accent-text', 'accent-tint'],
  ['ok', 'ok-tint'],
  ['warn', 'warn-tint'],
  ['danger-text', 'danger-tint'],
]

function parse(couleur) {
  const hex = couleur.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const rgba = couleur.match(/^rgba?\(([^)]+)\)$/)
  if (rgba) {
    const [r, g, b, a = 1] = rgba[1].split(',').map(Number)
    return { r, g, b, a }
  }
  throw new Error(`Couleur illisible : ${couleur}`)
}

/** Compose une couleur translucide sur un fond opaque. */
const poser = (dessus, dessous) => ({
  r: dessus.r * dessus.a + dessous.r * (1 - dessus.a),
  g: dessus.g * dessus.a + dessous.g * (1 - dessus.a),
  b: dessus.b * dessus.a + dessous.b * (1 - dessus.a),
  a: 1,
})

function luminance({ r, g, b }) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contraste(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

let echecs = 0
let paires = 0

function verifier(theme, libelle, texte, fond) {
  paires++
  const ratio = contraste(texte, fond)
  if (ratio < SEUIL) {
    echecs++
    console.log(`  ✗ ${theme} · ${libelle} : ${ratio.toFixed(2)}:1`)
  }
}

for (const [nom, t] of Object.entries(themes)) {
  const c = (role) => parse(t[role])
  for (const texte of TEXTES) {
    for (const fond of FONDS) verifier(nom, `${texte} sur ${fond}`, c(texte), c(fond))
  }
  for (const [encre, aplat] of ENCRES) verifier(nom, `${encre} sur ${aplat}`, c(encre), c(aplat))
  for (const [texte, teinte] of TEINTES) {
    for (const fond of FONDS) {
      verifier(nom, `${texte} sur ${teinte} posée sur ${fond}`, c(texte), poser(c(teinte), c(fond)))
    }
  }
}

if (echecs > 0) {
  console.log(`\n${echecs} paire(s) sous ${SEUIL}:1 sur ${paires}.`)
  process.exit(1)
}
console.log(`${paires} paires ≥ ${SEUIL}:1 dans les deux thèmes.`)
