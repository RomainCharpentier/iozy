/**
 * <b>The app says "tu", everywhere.</b> A "vous" slipped into a hint ("puis
 * vous confirmez") on a screen that says "tu" two lines above: nothing breaks,
 * the voice just changes. The only "vous" allowed is in a message written FOR
 * someone else (the offer sent to a seller).
 */
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Written to a third party, not to the person using the app. */
const ADRESSE_A_UN_TIERS = /seriez-vous/

describe('the voice of the app', () => {
  it('never says "vous" to the person using it', () => {
    const fautes: string[] = []
    for (const [fichier, texte] of Object.entries(sources)) {
      texte.split('\n').forEach((ligne, i) => {
        const nette = ligne.trim()
        if (nette.startsWith('//') || nette.startsWith('*') || nette.startsWith('/*') || nette.startsWith('{/*')) return
        if (ADRESSE_A_UN_TIERS.test(ligne)) return
        if (/\b(vous|votre|vos)\b/i.test(ligne)) fautes.push(`${fichier}:${i + 1}: ${nette}`)
      })
    }

    expect(fautes).toEqual([])
  })
})
