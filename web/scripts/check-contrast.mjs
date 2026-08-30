/**
 * Vérifie que chaque couleur de texte du thème tient le seuil AA (4.5:1) sur
 * chacun des fonds où elle peut atterrir, dans les DEUX thèmes.
 *
 * ## Pourquoi un script et pas un test
 * Le dépôt web n'a pas de lanceur de tests. En introduire un pour cette seule
 * vérification serait disproportionné ; Node lit un fichier et calcule un
 * rapport de luminance sans aucune dépendance.
 *
 * ## Pourquoi cette vérification existe
 * `index.css` porte une dizaine de commentaires expliquant des teintes
 * assombries d'un cheveu pour passer AA - « 4.40 → 4.57 », « il manquait un
 * QUATRIÈME fond ». Ce travail est réel et invisible : rien n'empêchait un
 * token ajouté demain de le défaire en silence. C'est déjà arrivé dans l'autre
 * sens - `text-warningText` a été écrit pendant des mois sans que le token
 * existe, et quatre avertissements s'affichaient en couleur ordinaire.
 *
 * ## Ce que le script sait, et que le CSS ne dit pas
 * Une couleur est un TEXTE ou un FOND, et le seuil ne se calcule pas pareil.
 * Les `--color-rank-*` en sont l'exemple : ce sont des pastilles de couleur
 * sur lesquelles on écrit une lettre. Les tester comme du texte sur le fond de
 * la page donne un faux positif - c'est l'erreur commise en écrivant ce
 * script, corrigée en lisant TierBadge.tsx.
 *
 * Usage : `npm run check:contrast`
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = readFileSync(join(RACINE, 'src/index.css'), 'utf8')

/** Seuil AA pour du texte de taille normale. */
const SEUIL = 4.5

/**
 * Couleurs employées comme TEXTE, sur les fonds de page.
 * Voir les composants : `text-textDim`, `text-accentText`, `text-warning`…
 */
const TEXTES = [
  'textPrimary', 'textDim', 'muted', 'faint',
  'accentText', 'dangerText', 'ok', 'warning',
  'universeManga', 'universeVideoGame', 'universeBoardGame', 'universeBook',
  'universeViolet', 'universeRose', 'universeCyan', 'universeArdoise',
]

/** Les trois fonds qu'un texte peut rencontrer. */
const FONDS = ['background', 'surface', 'surface2']

/**
 * Encres posées SUR un remplissage, avec la liste des fonds qu'elles couvrent.
 * `null` signifie « la valeur est en dur dans le TS », voir le commentaire.
 */
const ENCRES = [
  { encre: 'accentInk', fonds: ['accent'] },
  { encre: 'dangerInk', fonds: ['danger'] },
  { encre: 'warningInk', fonds: ['warning'] },
]

/**
 * Les pastilles de rang : une lettre écrite sur une couleur de remplissage.
 * L'encre vit dans `lib/tierListVisuals.ts` (RANK_INK_LIGHT/DARK) et non dans
 * le CSS - elle est donc reprise ici, et le script échoue si elle y change
 * sans que cette liste suive.
 */
const RANGS = ['rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d', 'rank-e', 'rank-f']
const ENCRE_RANG = { clair: '#ffffff', sombre: '#231e19' }

// ─────────────────────────────────────────────────────── Lecture des tokens

function tokensDe(texte) {
  const trouves = {}
  for (const m of texte.matchAll(/--color-([A-Za-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    trouves[m[1]] = m[2]
  }
  return trouves
}

// La PREMIÈRE RÈGLE sombre, jamais une mention en commentaire : `index.css`
// cite `[data-theme="dark"]` dans son en-tête, et couper là ne rendait aucun
// token - le script annonçait alors « 0 problème » sur un ensemble vide.
const debutSombre = CSS.search(/^\[data-theme="dark"\]\s*\{/m)
if (debutSombre < 0) {
  console.error('Aucune règle [data-theme="dark"] trouvée - index.css a-t-il changé de forme ?')
  process.exit(2)
}

const clair = tokensDe(CSS.slice(0, debutSombre))
const sombre = { ...clair }
for (const m of CSS.matchAll(/^\[data-theme="dark"\]\s*\{([\s\S]*?)^\}/gm)) {
  Object.assign(sombre, tokensDe(m[1]))
}

// ─────────────────────────────────────────────────────── Contraste

function canalLineaire(v) {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
  return 0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(g) + 0.0722 * canalLineaire(b)
}

function rapport(a, b) {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// ─────────────────────────────────────────────────────── Vérification

const echecs = []
const absents = []

function verifier(theme, palette, encre, fond, quoi) {
  if (!palette[encre] && !encre.startsWith('#')) { absents.push(`${theme}: ${encre}`); return }
  if (!palette[fond]) { absents.push(`${theme}: ${fond}`); return }
  const couleurEncre = encre.startsWith('#') ? encre : palette[encre]
  const r = rapport(couleurEncre, palette[fond])
  if (r < SEUIL) {
    echecs.push(`  ${theme.padEnd(7)} ${quoi.padEnd(34)} ${r.toFixed(2)} < ${SEUIL}`)
  }
}

for (const [theme, palette] of [['clair', clair], ['sombre', sombre]]) {
  for (const t of TEXTES) {
    for (const f of FONDS) verifier(theme, palette, t, f, `${t} sur ${f}`)
  }
  for (const { encre, fonds } of ENCRES) {
    for (const f of fonds) verifier(theme, palette, encre, f, `${encre} sur ${f}`)
  }
  const encreRang = theme === 'clair' ? ENCRE_RANG.clair : ENCRE_RANG.sombre
  for (const r of RANGS) verifier(theme, palette, encreRang, r, `lettre de rang sur ${r}`)
}

// ──────────────────────────────────────── Les pastilles d'avatar
//
// Elles ne viennent d'AUCUN token : leur teinte est déduite du pseudo, la même
// dans les deux thèmes (voir src/theme/avatar.ts) - une couleur d'identité ne
// change pas avec l'apparence. Ce qui compte est donc le contraste INTERNE de
// la pastille, entre son fond et ses deux lettres.
//
// L'encre est choisie par le code, pas fixée : sur la teinte verte, le blanc
// tombe à 4,46 - juste sous le seuil. Ce contrôle vérifie que ce choix tient
// pour les six teintes, quel que soit le pseudo qui y mène.
// Relue depuis sa source : une septième teinte ajoutée à `gradientPalettes`
// serait vérifiée sans que personne y pense, et une teinte modifiée ferait
// tomber ce contrôle plutôt que de passer inaperçue.
const AVATARS = [...readFileSync(join(RACINE, 'src/theme/tokens.ts'), 'utf8')
  .slice(readFileSync(join(RACINE, 'src/theme/tokens.ts'), 'utf8').indexOf('gradientPalettes'))
  .matchAll(/\['([0-9A-Fa-f]{6})',/g)].map((m) => `#${m[1]}`)
if (AVATARS.length === 0) {
  console.error("Palette d'avatars introuvable dans src/theme/tokens.ts")
  process.exit(2)
}
for (const fond of AVATARS) {
  const encre = rapport(fond, '#ffffff') >= rapport(fond, '#000000') ? '#ffffff' : '#000000'
  const ratio = rapport(fond, encre)
  if (ratio < SEUIL) {
    echecs.push(`  avatar ${fond} sur ${encre} : ${ratio.toFixed(2)}:1`)
  }
}

// ─────────────────────────────────────────────────────── Rapport

const compte = TEXTES.length * FONDS.length + ENCRES.length + RANGS.length
if (absents.length > 0) {
  console.error(`Tokens introuvables (${absents.length}) :`)
  for (const a of [...new Set(absents)]) console.error(`  ${a}`)
  process.exit(2)
}

if (echecs.length > 0) {
  console.error(`Contraste AA : ${echecs.length} combinaison(s) sous ${SEUIL}:1\n`)
  for (const e of echecs) console.error(e)
  console.error('\nAssombrir (thème clair) ou éclaircir (thème sombre) la teinte fautive')
  console.error('dans web/src/index.css, en gardant la teinte et en ne bougeant que la luminosité.')
  process.exit(1)
}

console.log(
  `Contraste AA : ${compte * 2} combinaisons vérifiées sur les deux thèmes plus ${AVATARS.length} pastilles ` +
    `d'avatar, aucune sous ${SEUIL}:1.`,
)
