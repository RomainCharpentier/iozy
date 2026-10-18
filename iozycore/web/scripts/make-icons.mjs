import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Makes the IozyCore brand: favicon.svg + apple-touch-icon.png.
 *
 * ## Why a script rather than two hand-written files
 * The two icons must show exactly the same drawing. Written separately, they
 * drift apart at the first adjustment - and nobody sees it, because we never
 * look at both at the same time. Here the geometry is declared ONCE (see
 * DESSIN) and is the source of both outputs: the SVG transcribes it, the PNG
 * rasterizes it.
 *
 * ## The drawing
 * Three slices standing on a shelf, the third one leaning. Not a monogram:
 * "IozyCore" at 16 pixels is unreadable, and the silhouette of a shelf says
 * what the application does where two letters say nothing. The leaning slice
 * is not decorative - it is what tells the brand apart from a bar chart.
 *
 * ## Zero dependency
 * Same choice as check-contrast.mjs: `zlib` is enough to write a PNG
 * (signature, IHDR, IDAT, IEND), and a 4x4 render per pixel gives the
 * anti-aliasing.
 *
 * Usage: `npm run icons`
 */

// ============================================ The drawing, in units of 32

const ACCENT_CLAIR = [0xbc, 0x58, 0x3b] //  #bc583b, --color-accent of the light theme
const ENCRE_CLAIRE = [0xff, 0xff, 0xff] //  #ffffff, --color-accentInk
const ACCENT_SOMBRE = '#d9694a' //          --color-accent of the dark theme
const ENCRE_SOMBRE = '#16120f' //           --color-accentInk of the dark theme

const DESSIN = {
  cote: 32,
  tuile: { x: 0, y: 0, w: 32, h: 32, r: 7.5 },
  // Three slices + the shelf. `angle` in degrees, pivot at the bottom-right corner.
  //
  // These numbers are dictated by the 16x16 size, not by the large format. A
  // first drawing, thinner and more elegant at 180px, left gaps of one unit
  // between the slices - half a pixel once reduced. Result measured at 16px:
  // "---##########---", a uniform blob. Hence the rule applied here: a gap of
  // 4 units = 2 full pixels at the size of a tab, and thick slices of 5.33
  // rather than thin ones.
  //
  // The shelf extends past the outer slices (3 -> 29 against 4 -> 27.6): this
  // overhang is what makes it read as a shelf and not as the axis of a bar
  // chart.
  formes: [
    { x: 4.0, y: 10.5, w: 5.33, h: 14.5, r: 1.5 },
    { x: 13.33, y: 7.2, w: 5.33, h: 17.8, r: 1.5 },
    { x: 22.27, y: 12.5, w: 5.33, h: 12.5, r: 1.5, angle: 9 },
    { x: 3.0, y: 25.0, w: 26.0, h: 2.2, r: 1.1 },
  ],
}

// ============================================ Geometry

/** Is the point inside the rounded-corner rectangle (possibly tilted)? */
function dansForme(px, py, f) {
  let x = px
  let y = py
  if (f.angle) {
    // Pivot: bottom-right corner, the one a leaning slice rests on.
    const cx = f.x + f.w
    const cy = f.y + f.h
    const a = (-f.angle * Math.PI) / 180 // inverse rotation: we bring the point back
    const dx = px - cx
    const dy = py - cy
    x = cx + dx * Math.cos(a) - dy * Math.sin(a)
    y = cy + dx * Math.sin(a) + dy * Math.cos(a)
  }
  const r = Math.min(f.r, f.w / 2, f.h / 2)
  const gx = Math.max(f.x + r - x, 0, x - (f.x + f.w - r))
  const gy = Math.max(f.y + r - y, 0, y - (f.y + f.h - r))
  if (x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h) return false
  return gx * gx + gy * gy <= r * r
}

// ============================================ SVG output

function svg() {
  const rect = (f) => {
    const t = f.angle ? ` transform="rotate(${f.angle} ${f.x + f.w} ${f.y + f.h})"` : ''
    return `    <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r}" fill="var(--encre)"${t}/>`
  }
  // Explicit width/height in addition to the viewBox: without them, an SVG
  // with no dimensions gets an arbitrary size from the consumer (300x150 by
  // default in HTML). The favicon does not care, everything else does.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="IozyCore">
  <!-- Généré par web/scripts/make-icons.mjs - ne pas modifier à la main. -->
  <style>
    /* Le favicon vit dans le chrome du NAVIGATEUR, pas dans la page : il suit
       la préférence du système, pas le thème choisi dans l'application. */
    :root { --tuile: #${ACCENT_CLAIR.map((c) => c.toString(16).padStart(2, '0')).join('')}; --encre: #ffffff; }
    @media (prefers-color-scheme: dark) {
      :root { --tuile: ${ACCENT_SOMBRE}; --encre: ${ENCRE_SOMBRE}; }
    }
  </style>
  <rect x="0" y="0" width="32" height="32" rx="${DESSIN.tuile.r}" fill="var(--tuile)"/>
${DESSIN.formes.map(rect).join('\n')}
</svg>
`
}

// ============================================ PNG output

const TABLE_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const octet of buf) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloc(type, donnees) {
  const entete = Buffer.alloc(8)
  entete.writeUInt32BE(donnees.length, 0)
  entete.write(type, 4, 'ascii')
  const somme = Buffer.alloc(4)
  somme.writeUInt32BE(crc32(Buffer.concat([entete.subarray(4), donnees])), 0)
  return Buffer.concat([entete, donnees, somme])
}

/** 4x4 render per pixel: without it the rounded corners look jagged at 180px. */
const SOUS_ECHANTILLON = 4

/**
 * Share of the width that the drawing takes in a "maskable" icon.
 *
 * An Android launcher cuts the icon to whatever shape it wants - circle,
 * drop, rounded square - guaranteeing only the central disc of 80% of the
 * side. The drawing is therefore reduced inside this safe zone, and the
 * background fills the WHOLE square: this is the only way a circular cut does
 * not show a transparent corner. The same icon served as `any` would have the
 * opposite flaw - a tile floating in the middle of nothing.
 */
const ZONE_SURE = 0.62

function png(taille, { masquable = false } = {}) {
  const octets = Buffer.alloc(taille * (taille * 4 + 1))
  const echelle = DESSIN.cote / taille
  // When maskable, the drawing is brought back to the center: a canvas point
  // is projected into the drawing space by moving away from the center by the
  // same factor.
  const projeter = (v) =>
    masquable ? ((v / taille - 0.5) * DESSIN.cote) / ZONE_SURE + DESSIN.cote / 2 : v * echelle
  for (let py = 0; py < taille; py++) {
    const debutLigne = py * (taille * 4 + 1)
    octets[debutLigne] = 0 // filter "None"
    for (let px = 0; px < taille; px++) {
      let dansTuile = 0
      let dansEncre = 0
      for (let sy = 0; sy < SOUS_ECHANTILLON; sy++) {
        for (let sx = 0; sx < SOUS_ECHANTILLON; sx++) {
          const x = projeter(px + (sx + 0.5) / SOUS_ECHANTILLON)
          const y = projeter(py + (sy + 0.5) / SOUS_ECHANTILLON)
          // Background full edge to edge when maskable: the launcher does the cutting.
          if (masquable || dansForme(x, y, DESSIN.tuile)) dansTuile++
          if (DESSIN.formes.some((f) => dansForme(x, y, f))) dansEncre++
        }
      }
      const total = SOUS_ECHANTILLON * SOUS_ECHANTILLON
      const aTuile = dansTuile / total
      const aEncre = dansEncre / total
      // The ink is placed ON the tile: it never goes past its rounded corners.
      const encre = Math.min(aEncre, aTuile)
      const i = debutLigne + 1 + px * 4
      for (let c = 0; c < 3; c++) {
        // Classic compositing on a transparent background, premultiplied then rendered.
        const couleur = aTuile > 0 ? (ACCENT_CLAIR[c] * (aTuile - encre) + ENCRE_CLAIRE[c] * encre) / aTuile : 0
        octets[i + c] = Math.round(couleur)
      }
      octets[i + 3] = Math.round(aTuile * 255)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(taille, 0)
  ihdr.writeUInt32BE(taille, 4)
  ihdr[8] = 8 // 8 bits per channel
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(octets, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

// ============================================ The manifest

/**
 * The manifest comes from HERE, with the icons it declares.
 *
 * A promised and missing icon does not make the app less pretty: it makes it
 * **not installable**, with no error message anywhere - the browser simply
 * removes the prompt. The two files must therefore be born from the same
 * gesture, exactly like the SVG and the PNG above are born from the same
 * geometry.
 *
 * `background_color` and `theme_color` reuse the dark theme background
 * (`--color-background`, see index.css): it is the default theme of the app,
 * and these two colors dress the startup screen and the system bar BEFORE a
 * single line of CSS is loaded.
 */
const FOND_SOMBRE = '#16120f'

function manifeste(icones) {
  return {
    name: 'IozyCore',
    // What fits under a home screen icon, where space is limited.
    short_name: 'IozyCore',
    description: 'Ta collection, ce qu’il te manque, et ce que vaut une annonce.',
    lang: 'fr',
    dir: 'ltr',
    // Relative to the manifest itself: the app lives at the root in dev and
    // under /core/ in the Docker image, and the same file must hold for both.
    start_url: './',
    scope: './',
    // "standalone" and not "fullscreen": the app keeps the phone status bar
    // (time, battery, network) - it is opened at a flea market, where we need
    // to know what time it is.
    display: 'standalone',
    orientation: 'portrait',
    background_color: FOND_SOMBRE,
    theme_color: FOND_SOMBRE,
    icons: icones,
  }
}

// ============================================ Writing

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(racine, { recursive: true })
writeFileSync(join(racine, 'favicon.svg'), svg())
// 180: the size requested by iOS for the home screen, and more than enough
// to also serve as a raster fallback for browsers without SVG favicons.
writeFileSync(join(racine, 'apple-touch-icon.png'), png(180))

/**
 * 192 and 512 are the two sizes a browser requires to offer the
 * installation; the maskable 512 is the one that Android launchers cut.
 * Three files, one single drawing.
 */
const ICONES = [
  { fichier: 'icon-192.png', taille: 192, purpose: 'any' },
  { fichier: 'icon-512.png', taille: 512, purpose: 'any' },
  { fichier: 'icon-512-maskable.png', taille: 512, purpose: 'maskable', masquable: true },
]

for (const icone of ICONES) {
  writeFileSync(join(racine, icone.fichier), png(icone.taille, { masquable: icone.masquable }))
}

writeFileSync(
  join(racine, 'manifest.webmanifest'),
  JSON.stringify(
    manifeste(
      ICONES.map((i) => ({
        src: i.fichier,
        sizes: `${i.taille}x${i.taille}`,
        type: 'image/png',
        purpose: i.purpose,
      })),
    ),
    null,
    2,
  ) + '\n',
)

console.log(
  ['favicon.svg', 'apple-touch-icon.png (180)', ...ICONES.map((i) => `${i.fichier} (${i.taille})`), 'manifest.webmanifest']
    .join(', ') + ' written to public/',
)
