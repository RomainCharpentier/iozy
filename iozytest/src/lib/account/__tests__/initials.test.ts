import { describe, expect, it } from 'vitest'
import { initialsOf } from '@/lib/account/initials'

describe("initiales de l'avatar", () => {
  it('prend la première lettre de deux mots', () => {
    expect(initialsOf('jean-dupont')).toBe('JD')
  })

  it("prend les deux premières lettres d'un seul mot", () => {
    expect(initialsOf('kenshin')).toBe('KE')
  })

  it('ne rend rien pour un pseudo vide (le lien retombe sur « IO »)', () => {
    expect(initialsOf('  ')).toBe('')
  })
})
