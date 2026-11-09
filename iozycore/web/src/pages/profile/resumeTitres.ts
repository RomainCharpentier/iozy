import type { TitleComposition } from '@/common/lib/titleLanguage'

/** "Français, puis romaji": the active languages in order, for the closed row. */
export function resumeTitres(composition: TitleComposition): string {
  const actives = composition.filter((item) => item.enabled).map((item) => COURT[item.language])
  if (actives.length === 0) return 'Aucune langue'
  const [premiere, ...suite] = actives
  return suite.length === 0 ? premiere : `${premiere}, puis ${suite.join(', puis ').toLowerCase()}`
}

const COURT: Record<TitleComposition[number]['language'], string> = {
  FRENCH: 'Français',
  ENGLISH: 'Anglais',
  ROMAJI: 'Romaji',
}
