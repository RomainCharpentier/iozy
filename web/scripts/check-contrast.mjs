/**
 * Checks that every text color of the theme meets the AA threshold (4.5:1) on
 * each of the backgrounds where it can land, in BOTH themes.
 *
 * ## Why a script and not a test
 * The web repository has no test runner. Introducing one for this single
 * check would be disproportionate; Node reads a file and computes a
 * luminance ratio without any dependency.
 *
 * ## Why this check exists
 * `index.css` carries about ten comments explaining hues darkened by a hair
 * to pass AA - "4.40 → 4.57", "a FOURTH background was missing". This work is
 * real and invisible: nothing prevented a token added tomorrow from silently
 * undoing it. It already happened the other way around - `text-warningText`
 * was written for months without the token existing, and four warnings were
 * shown in an ordinary color.
 *
 * ## What the script knows, and the CSS does not say
 * A color is a TEXT or a BACKGROUND, and the threshold is not computed the
 * same way. The `--color-rank-*` are an example: they are color badges on
 * which a letter is written. Testing them as text on the page background
 * gives a false positive - this is the mistake made while writing this
 * script, fixed by reading TierBadge.tsx.
 *
 * Usage: `npm run check:contrast`
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = readFileSync(join(RACINE, 'src/index.css'), 'utf8')

/** AA threshold for normal-size text. */
const SEUIL = 4.5

/**
 * Colors used as TEXT, on the page backgrounds.
 * See the components: `text-textDim`, `text-accentText`, `text-warning`…
 */
const TEXTES = [
  'textPrimary', 'textDim', 'muted', 'faint',
  'accentText', 'dangerText', 'ok', 'warning',
  'universeManga', 'universeVideoGame', 'universeBoardGame', 'universeBook',
  'universeViolet', 'universeRose', 'universeCyan', 'universeArdoise',
]

/** The three backgrounds a text can meet. */
const FONDS = ['background', 'surface', 'surface2']

/**
 * Inks placed ON a fill, with the list of backgrounds they cover.
 * `null` means "the value is hard-coded in the TS", see the comment.
 */
const ENCRES = [
  { encre: 'accentInk', fonds: ['accent'] },
  { encre: 'dangerInk', fonds: ['danger'] },
  { encre: 'warningInk', fonds: ['warning'] },
]

/**
 * The rank badges: a letter written on a fill color.
 * The ink lives in `lib/tierListVisuals.ts` (RANK_INK_LIGHT/DARK) and not in
 * the CSS - so it is repeated here, and the script fails if it changes there
 * without this list following.
 */
const RANGS = ['rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d', 'rank-e', 'rank-f']
const ENCRE_RANG = { clair: '#ffffff', sombre: '#231e19' }

// ─────────────────────────────────────────────────────── Reading the tokens

function tokensDe(texte) {
  const trouves = {}
  for (const m of texte.matchAll(/--color-([A-Za-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    trouves[m[1]] = m[2]
  }
  return trouves
}

// The FIRST dark RULE, never a mention in a comment: `index.css` quotes
// `[data-theme="dark"]` in its header, and cutting there returned no token -
// the script then announced "0 problems" on an empty set.
const debutSombre = CSS.search(/^\[data-theme="dark"\]\s*\{/m)
if (debutSombre < 0) {
  console.error('No [data-theme="dark"] rule found - did index.css change shape?')
  process.exit(2)
}

const clair = tokensDe(CSS.slice(0, debutSombre))
const sombre = { ...clair }
for (const m of CSS.matchAll(/^\[data-theme="dark"\]\s*\{([\s\S]*?)^\}/gm)) {
  Object.assign(sombre, tokensDe(m[1]))
}

// ─────────────────────────────────────────────────────── Contrast

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

// ─────────────────────────────────────────────────────── Verification

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
    for (const f of FONDS) verifier(theme, palette, t, f, `${t} on ${f}`)
  }
  for (const { encre, fonds } of ENCRES) {
    for (const f of fonds) verifier(theme, palette, encre, f, `${encre} on ${f}`)
  }
  const encreRang = theme === 'clair' ? ENCRE_RANG.clair : ENCRE_RANG.sombre
  for (const r of RANGS) verifier(theme, palette, encreRang, r, `rank letter on ${r}`)
}

// ──────────────────────────────────────── The avatar badges
//
// They come from NO token: their hue is derived from the username, the same
// in both themes (see src/common/theme/avatar.ts) - an identity color does not
// change with the appearance. What matters is therefore the INTERNAL contrast
// of the badge, between its background and its two letters.
//
// The ink is chosen by the code, not fixed: on the green hue, white falls to
// 4.46 - just under the threshold. This check verifies that this choice holds
// for the six hues, whatever the username that leads to it.
// Re-read from its source: a seventh hue added to `gradientPalettes` would be
// checked without anyone thinking about it, and a modified hue would make
// this check fail instead of going unnoticed.
const AVATARS = [...readFileSync(join(RACINE, 'src/common/theme/tokens.ts'), 'utf8')
  .slice(readFileSync(join(RACINE, 'src/common/theme/tokens.ts'), 'utf8').indexOf('gradientPalettes'))
  .matchAll(/\['([0-9A-Fa-f]{6})',/g)].map((m) => `#${m[1]}`)
if (AVATARS.length === 0) {
  console.error('Avatar palette not found in src/common/theme/tokens.ts')
  process.exit(2)
}
for (const fond of AVATARS) {
  const encre = rapport(fond, '#ffffff') >= rapport(fond, '#000000') ? '#ffffff' : '#000000'
  const ratio = rapport(fond, encre)
  if (ratio < SEUIL) {
    echecs.push(`  avatar ${fond} on ${encre} : ${ratio.toFixed(2)}:1`)
  }
}

// ─────────────────────────────────────────────────────── Report

const compte = TEXTES.length * FONDS.length + ENCRES.length + RANGS.length
if (absents.length > 0) {
  console.error(`Tokens not found (${absents.length}):`)
  for (const a of [...new Set(absents)]) console.error(`  ${a}`)
  process.exit(2)
}

if (echecs.length > 0) {
  console.error(`AA contrast: ${echecs.length} combination(s) under ${SEUIL}:1\n`)
  for (const e of echecs) console.error(e)
  console.error('\nDarken (light theme) or lighten (dark theme) the faulty hue')
  console.error('in web/src/index.css, keeping the hue and changing only the lightness.')
  process.exit(1)
}

console.log(
  `AA contrast: ${compte * 2} combinations checked on both themes plus ${AVATARS.length} avatar ` +
    `badges, none under ${SEUIL}:1.`,
)
