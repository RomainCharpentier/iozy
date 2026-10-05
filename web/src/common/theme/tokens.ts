// Design tokens - mirror of src/index.css (@theme, for the Tailwind classes
// bg-accent/text-textDim/etc.) - this file is the source of truth for pure
// TS/JS (e.g. theme/gradient.ts, which needs the raw hex values).
// Terracotta palette (IozyCore DS v1.1) adopted on 2026-08-19 - see
// docs/DESIGN_MIGRATION_V1.2.md. Snapshot of the DARK theme (default of the
// app, see lib/theme.ts): this file has no light/dark mechanism of its own,
// unlike index.css (no current JS consumer needs one in light - to be
// revisited if a real use appears).
// <p>
// ios/IozyCore/DesignSystem/Theme.swift stays on the old direction (lime
// on dark) as long as it has not received its own migration batch (explicitly
// accepted, iOS outside the scope of this batch) - so no longer a real mirror
// for now, just documented as such for next time.
export const colors = {
  background: '#16120F',
  surface: '#231E19',
  surface2: '#2C261F',
  textPrimary: '#F4EEE7',
  textDim: '#C2B5A9',
  accent: '#D9694A',
  accentText: '#EF9070',
  violet: '#8B7FFF',
  pink: '#FF6FA5',
} as const

// Gradient pairs for the cover tiles (no real cover images,
// rights not available) - warm and muted tones, consistent with the
// terracotta palette (see DS v1.1, demonstration of the Tier components:
// substitute covers in this same warm/matte register rather than saturated
// neon). Replaces the 6 saturated pairs of the old lime direction, which
// would clash next to the new accent. See gradient.ts for the selection
// algorithm (deterministic by title, unchanged).
export const gradientPalettes: readonly [string, string][] = [
  ['C2492F', '5E1F14'],
  ['8A6A3A', '33251A'],
  ['4A4658', '16151C'],
  ['5C4A52', '1D1518'],
  ['7A6A6A', '241D1D'],
  ['6B7D5A', '242D1D'],
]
