// Design tokens - miroir de src/index.css (@theme, pour les classes Tailwind
// bg-accent/text-textDim/etc.) - ce fichier est la source de vérité pour le
// TS/JS pur (ex: theme/gradient.ts, qui a besoin des valeurs hex brutes).
// Palette terracotta (IozyCore DS v1.1) adoptée le 2026-08-19 - voir
// docs/DESIGN_MIGRATION_V1.2.md. Snapshot du thème SOMBRE (défaut de l'app,
// voir lib/theme.ts) : ce fichier n'a pas de mécanisme clair/sombre propre,
// contrairement à index.css (aucun consommateur JS actuel n'en a besoin en
// clair - à revisiter si un usage réel apparaît).
// <p>
// ios/IozyCore/DesignSystem/Theme.swift reste sur l'ancienne direction (lime
// sur sombre) tant qu'il n'a pas reçu son propre lot de migration (accepté
// explicitement, iOS hors périmètre de ce lot) - donc plus un vrai miroir
// pour l'instant, juste documenté comme tel pour la prochaine fois.
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

// Paires de dégradé pour les tuiles de couverture (pas d'images de
// couverture réelles, droits non disponibles) - tons chauds et sourds,
// cohérents avec la palette terracotta (voir DS v1.1, démonstration des
// composants Tier : jaquettes de substitution dans ce même registre chaud/
// mat plutôt que saturé néon). Remplace les 6 paires saturées de l'ancienne
// direction lime, qui jureraient à côté du nouvel accent. Voir gradient.ts
// pour l'algorithme de sélection (déterministe par titre, inchangé).
export const gradientPalettes: readonly [string, string][] = [
  ['C2492F', '5E1F14'],
  ['8A6A3A', '33251A'],
  ['4A4658', '16151C'],
  ['5C4A52', '1D1518'],
  ['7A6A6A', '241D1D'],
  ['6B7D5A', '242D1D'],
]
