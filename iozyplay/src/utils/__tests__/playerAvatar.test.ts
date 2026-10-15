import { describe, it, expect } from 'vitest'
import { DEFAULT_AVATAR, getLocalPlayerAvatar, getPlayerAvatarLabel } from '@/utils/playerAvatar'

describe('playerAvatar', () => {
  it("affiche l'avatar du joueur s'il existe", () => {
    expect(getPlayerAvatarLabel({ name: 'Bob', avatar: '🤖' })).toBe('🤖')
  })

  it("se replie sur l'initiale si l'avatar est absent ou vide", () => {
    expect(getPlayerAvatarLabel({ name: 'bob' })).toBe('B')
    expect(getPlayerAvatarLabel({ name: 'bob', avatar: '  ' })).toBe('B')
  })

  it('gère un nom vide ou commençant par un emoji', () => {
    expect(getPlayerAvatarLabel({ name: '' })).toBe('?')
    expect(getPlayerAvatarLabel({ name: '😀abc' })).toBe('😀')
  })

  it("envoie l'avatar par défaut", () => {
    expect(getLocalPlayerAvatar()).toBe(DEFAULT_AVATAR)
  })
})
