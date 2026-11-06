import { describe, it, expect } from 'vitest'
import { buildSuggestionPool } from '@/pages/GamePage/question/useAnswerSuggestions'

describe('buildSuggestionPool', () => {
  it('dédoublonne, ignore les valeurs vides ou absentes et trie', () => {
    expect(buildSuggestionPool(['Zelda ', 'Mario', undefined, '', 'Zelda', 42])).toEqual([
      'Mario',
      'Zelda',
    ])
  })
})
