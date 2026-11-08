import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Vérifie WCAG AA (4,5:1, et 3:1 hors texte) sur les paires qui comptent, dans les deux
 * thèmes, depuis tokens.json. Liste chaque paire sous son seuil et échoue (code 1).
 *
 * Quatre groupes de paires, parce que ce sont les erreurs qu'on fait :
 * - un texte sur les TROIS fonds du thème (pas seulement le plus contrasté) ;
 * - une encre SUR son aplat (bouton primaire, badge plein) ;
 * - un texte d'état sur sa teinte, elle-même posée sur chaque fond ;
 * - le bord d'un champ et l'anneau de focus sur chaque fond (3:1).
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

/**
 * Hors texte, WCAG 1.4.11 demande 3:1 : le bord d'un champ et l'anneau de
 * focus doivent se voir sur chaque fond. Un rôle translucide est d'abord
 * posé sur le fond, puis comparé à ce même fond.
 */
const SEUIL_NON_TEXTE = 3
const NON_TEXTES = ['accent', 'field-border']

/**
 * Le verre et le fond plein cadre. Sous le verre, il n'y a plus un fond du
 * thème mais une jaquette floutée, qu'on ne connaît pas d'avance : on prend
 * les deux pires, une jaquette noire et une jaquette blanche. Chacune passe
 * par le filtre du fond (`backdrop-brightness`), puis le voile
 * (`backdrop-veil`), puis, le cas échéant, le verre lui-même. Le texte doit
 * tenir sur les trois couches :
 * - à même le fond voilé : tous les textes du thème ;
 * - sur le verre léger (barre, pastilles) : le texte et le texte secondaire ;
 * - sur le verre fort (panneaux, cartes) : tous les textes, plus l'accent écrit.
 */
const PIRES_JAQUETTES = [
  ['noire', { r: 0, g: 0, b: 0, a: 1 }],
  ['blanche', { r: 255, g: 255, b: 255, a: 1 }],
]
const COUCHES_VERRE = [
  [null, ['text', 'text-dim', 'text-muted', 'text-faint']],
  ['glass-surface', ['text', 'text-dim']],
  ['glass-surface-strong', ['text', 'text-dim', 'text-muted', 'text-faint', 'accent-text']],
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

function verifier(theme, libelle, texte, fond, seuil = SEUIL) {
  paires++
  const ratio = contraste(texte, fond)
  if (ratio < seuil) {
    echecs++
    console.log(`  ✗ ${theme} · ${libelle} : ${ratio.toFixed(2)}:1 (attendu ${seuil}:1)`)
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
  for (const role of NON_TEXTES) {
    for (const fond of FONDS) {
      verifier(nom, `${role} sur ${fond}`, poser(c(role), c(fond)), c(fond), SEUIL_NON_TEXTE)
    }
  }
  const eclat = Number(t['backdrop-brightness'])
  for (const [jaquette, pixel] of PIRES_JAQUETTES) {
    const filtre = { r: Math.min(255, pixel.r * eclat), g: Math.min(255, pixel.g * eclat), b: Math.min(255, pixel.b * eclat), a: 1 }
    const voile = poser(c('backdrop-veil'), filtre)
    for (const [verre, textes] of COUCHES_VERRE) {
      const fond = verre ? poser(c(verre), voile) : voile
      const ou = verre ? `${verre} sur jaquette ${jaquette} voilée` : `jaquette ${jaquette} voilée`
      for (const texte of textes) verifier(nom, `${texte} sur ${ou}`, c(texte), fond)
    }
  }
}

if (echecs > 0) {
  console.log(`\n${echecs} paire(s) sous leur seuil sur ${paires}.`)
  process.exit(1)
}
console.log(
  `${paires} paires conformes dans les deux thèmes (texte ≥ ${SEUIL}:1, bord et focus ≥ ${SEUIL_NON_TEXTE}:1).`,
)
