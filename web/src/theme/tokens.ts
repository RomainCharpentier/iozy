// Design tokens - miroir de ios/IozyCore/DesignSystem/Theme.swift (direction
// visuelle validée : fond sombre, accent vert-jaune vif). Les mêmes valeurs
// sont dupliquées dans src/index.css (@theme, pour les classes Tailwind
// bg-accent/text-textDim/etc.) - ce fichier est la source de vérité pour le
// TS/JS pur (ex: theme/gradient.ts, qui a besoin des valeurs hex brutes).
export const colors = {
  background: '#131316',
  surface: '#1D1D21',
  surface2: '#26262B',
  textPrimary: '#F5F4F2',
  textDim: '#8C8B92',
  accent: '#B8FF3C',
  accentText: '#0E1500',
  violet: '#8B7FFF',
  pink: '#FF6FA5',
} as const

// Paires de dégradé pour les tuiles de couverture (pas d'images de
// couverture réelles, droits non disponibles) - mêmes 6 paires que
// Theme.swift. Voir gradient.ts pour l'algorithme de sélection.
export const gradientPalettes: readonly [string, string][] = [
  ['FF6FA5', '8B3E5C'],
  ['8B7FFF', '3E3480'],
  ['B8FF3C', '4B6B10'],
  ['FFA43C', '8A4E10'],
  ['3CDFFF', '1B6B80'],
  ['FF5C5C', '801F1F'],
]
