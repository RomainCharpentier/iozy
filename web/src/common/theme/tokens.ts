// The interface colors are NOT mirrored here: they live in the IozyKit charter
// (vendor/iozykit/tokens.json, copied by `npm run kit:sync`) and reach the code
// through the Tailwind classes of src/index.css (bg-surface, text-textDim...)
// or `var(--color-*)` in an inline style. A hex value written here would be a
// second source, out of phase with the kit at the first change.
//
// Gradient pairs for the cover tiles (no real cover images, rights not
// available) and the avatar badges (see avatar.ts): warm and muted tones, in
// the register of the terracotta charter (IozyKit/CHARTE.md), rather than
// saturated neon next to the accent. Content colors, not interface roles, so
// they are not kit tokens. See gradient.ts for the selection algorithm
// (deterministic by title). `check:contrast` reads this list: each pair must
// carry white or black initials at 4.5:1.
export const gradientPalettes: readonly [string, string][] = [
  ['C2492F', '5E1F14'],
  ['8A6A3A', '33251A'],
  ['4A4658', '16151C'],
  ['5C4A52', '1D1518'],
  ['7A6A6A', '241D1D'],
  ['6B7D5A', '242D1D'],
]
