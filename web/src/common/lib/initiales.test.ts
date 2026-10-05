import { describe, expect, it } from 'vitest'
import { initiales } from './initiales'

/**
 * <b>Two letters on the most visible element of the header.</b>
 *
 * <p>The avatar displayed "IO" hard-coded, whatever the signed-in account.
 * It now carries the initials of the username — and each rule below breaks
 * silently: the avatar simply displays something else, on all the pages,
 * next to nothing that could contradict it.
 */
describe('the initials of a username', () => {
  it('takes the first two letters of a one-piece username', () => {
    expect(initiales('kenshin')).toBe('KE')
  })

  it('takes one letter per piece when the username has several', () => {
    // "JE" would make jean-dupont and jean-durand the same avatar.
    expect(initiales('jean-dupont')).toBe('JD')
    expect(initiales('marie_c')).toBe('MC')
    expect(initiales('r.charpentier')).toBe('RC')
    expect(initiales('Jean Dupont')).toBe('JD')
  })

  it('stops at two pieces, even when the username has three', () => {
    expect(initiales('jean-paul-sartre')).toBe('JP')
  })

  it('keeps the accents and makes them capitals', () => {
    expect(initiales('Émile')).toBe('ÉM')
    expect(initiales('émile-zola')).toBe('ÉZ')
  })

  it('does not cut a letter in two', () => {
    // A character outside the base plane is written on two code units:
    // `pseudo[0]` would render half of it, that is a black diamond in the header.
    expect(initiales('𝒜lice')).toBe('𝒜L')
  })

  it('returns empty rather than inventing, when there is nothing to read', () => {
    expect(initiales('')).toBe('')
    expect(initiales('   ')).toBe('')
    expect(initiales('---')).toBe('')
  })
})
