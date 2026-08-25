import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Fabrique la marque d'IozyCore : favicon.svg + apple-touch-icon.png.
 *
 * ## Pourquoi un script plutôt que deux fichiers écrits à la main
 * Les deux icônes doivent montrer exactement le même dessin. Écrites
 * séparément, elles divergent au premier ajustement - et personne ne le voit,
 * parce qu'on ne regarde jamais les deux en même temps. Ici la géométrie est
 * déclarée UNE fois (voir DESSIN) et sert de source aux deux sorties : le SVG
 * la transcrit, le PNG la rastérise.
 *
 * ## Le dessin
 * Trois tranches debout sur une étagère, la troisième penchée. Pas un
 * monogramme : « IozyCore » en 16 pixels est illisible, et la silhouette d'une
 * étagère dit ce que fait l'application là où deux lettres ne disent rien. La
 * tranche penchée n'est pas décorative - c'est elle qui distingue la marque
 * d'un diagramme en bâtons.
 *
 * ## Zéro dépendance
 * Même parti pris que check-contrast.mjs : `zlib` suffit à écrire un PNG
 * (signature, IHDR, IDAT, IEND), et un rendu 4x4 par pixel donne l'anticrénelage.
 *
 * Usage : `npm run icons`
 */

// ============================================ Le dessin, en unités de 32

const ACCENT_CLAIR = [0xbc, 0x58, 0x3b] //  #bc583b, --color-accent du thème clair
const ENCRE_CLAIRE = [0xff, 0xff, 0xff] //  #ffffff, --color-accentInk
const ACCENT_SOMBRE = '#d9694a' //          --color-accent du thème sombre
const ENCRE_SOMBRE = '#16120f' //           --color-accentInk du thème sombre

const DESSIN = {
  cote: 32,
  tuile: { x: 0, y: 0, w: 32, h: 32, r: 7.5 },
  // Trois tranches + l'étagère. `angle` en degrés, pivot au coin bas-droit.
  //
  // Ces nombres sont dictés par le 16x16, pas par le grand format. Un premier
  // dessin, plus fin et plus élégant à 180px, laissait entre les tranches des
  // écarts d'une unité - un demi-pixel une fois réduit. Résultat mesuré à
  // 16px : « ---##########--- », un pâté uniforme. D'où la règle appliquée
  // ici : écart de 4 unités = 2 pixels pleins à la taille d'un onglet, et
  // tranches épaisses de 5,33 plutôt que fines.
  //
  // L'étagère déborde des tranches extrêmes (3 -> 29 contre 4 -> 27,6) : c'est
  // ce débord qui la fait lire comme une étagère et non comme l'axe d'un
  // diagramme en bâtons.
  formes: [
    { x: 4.0, y: 10.5, w: 5.33, h: 14.5, r: 1.5 },
    { x: 13.33, y: 7.2, w: 5.33, h: 17.8, r: 1.5 },
    { x: 22.27, y: 12.5, w: 5.33, h: 12.5, r: 1.5, angle: 9 },
    { x: 3.0, y: 25.0, w: 26.0, h: 2.2, r: 1.1 },
  ],
}

// ============================================ Géométrie

/** Le point est-il dans le rectangle à coins arrondis (éventuellement incliné) ? */
function dansForme(px, py, f) {
  let x = px
  let y = py
  if (f.angle) {
    // Pivot : coin bas-droit, celui sur lequel une tranche penchée s'appuie.
    const cx = f.x + f.w
    const cy = f.y + f.h
    const a = (-f.angle * Math.PI) / 180 // rotation inverse : on ramène le point
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

// ============================================ Sortie SVG

function svg() {
  const rect = (f) => {
    const t = f.angle ? ` transform="rotate(${f.angle} ${f.x + f.w} ${f.y + f.h})"` : ''
    return `    <rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="${f.r}" fill="var(--encre)"${t}/>`
  }
  // width/height explicites en plus du viewBox : sans eux, un SVG sans
  // dimensions se voit attribuer une taille arbitraire par le consommateur
  // (300x150 par défaut en HTML). Le favicon s'en moque, pas tout le reste.
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

// ============================================ Sortie PNG

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

/** Rendu 4x4 par pixel : sans ça les coins arrondis crénellent à 180px. */
const SOUS_ECHANTILLON = 4

function png(taille) {
  const octets = Buffer.alloc(taille * (taille * 4 + 1))
  const echelle = DESSIN.cote / taille
  for (let py = 0; py < taille; py++) {
    const debutLigne = py * (taille * 4 + 1)
    octets[debutLigne] = 0 // filtre « None »
    for (let px = 0; px < taille; px++) {
      let dansTuile = 0
      let dansEncre = 0
      for (let sy = 0; sy < SOUS_ECHANTILLON; sy++) {
        for (let sx = 0; sx < SOUS_ECHANTILLON; sx++) {
          const x = (px + (sx + 0.5) / SOUS_ECHANTILLON) * echelle
          const y = (py + (sy + 0.5) / SOUS_ECHANTILLON) * echelle
          if (dansForme(x, y, DESSIN.tuile)) dansTuile++
          if (DESSIN.formes.some((f) => dansForme(x, y, f))) dansEncre++
        }
      }
      const total = SOUS_ECHANTILLON * SOUS_ECHANTILLON
      const aTuile = dansTuile / total
      const aEncre = dansEncre / total
      // L'encre est posée SUR la tuile : elle ne dépasse jamais ses arrondis.
      const encre = Math.min(aEncre, aTuile)
      const i = debutLigne + 1 + px * 4
      for (let c = 0; c < 3; c++) {
        // Composition classique sur fond transparent, prémultipliée puis rendue.
        const couleur = aTuile > 0 ? (ACCENT_CLAIR[c] * (aTuile - encre) + ENCRE_CLAIRE[c] * encre) / aTuile : 0
        octets[i + c] = Math.round(couleur)
      }
      octets[i + 3] = Math.round(aTuile * 255)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(taille, 0)
  ihdr.writeUInt32BE(taille, 4)
  ihdr[8] = 8 // 8 bits par canal
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(octets, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

// ============================================ Écriture

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(racine, { recursive: true })
writeFileSync(join(racine, 'favicon.svg'), svg())
// 180 : la taille demandée par iOS pour l'écran d'accueil, et largement assez
// pour servir aussi de repli raster aux navigateurs sans favicon SVG.
writeFileSync(join(racine, 'apple-touch-icon.png'), png(180))
console.log('favicon.svg et apple-touch-icon.png (180x180) écrits dans public/')
