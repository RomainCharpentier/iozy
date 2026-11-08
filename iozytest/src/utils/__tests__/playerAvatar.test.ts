import { describe, it, expect, afterEach } from 'vitest'
import { settingsService } from '@/services/settingsService'
import {
  AVATAR_CHOICES,
  DEFAULT_AVATAR,
  getLocalPlayerAvatar,
  getPlayerAvatarLabel,
} from '@/utils/playerAvatar'

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

  describe('getLocalPlayerAvatar', () => {
    afterEach(() => settingsService.resetSettings())

    it("envoie l'avatar par défaut si rien n'est choisi", () => {
      settingsService.resetSettings()
      expect(getLocalPlayerAvatar()).toBe(DEFAULT_AVATAR)
    })

    it("envoie l'avatar choisi dans les réglages", () => {
      settingsService.updateSetting('avatar', '🦊')
      expect(getLocalPlayerAvatar()).toBe('🦊')
    })

    it('ignore un avatar stocké qui ne fait pas partie des choix', () => {
      settingsService.updateSetting('avatar', 'pas un avatar')
      expect(getLocalPlayerAvatar()).toBe(DEFAULT_AVATAR)
    })
  })

  it('propose des avatars uniques, courts, avec le défaut en premier', () => {
    const emojis = AVATAR_CHOICES.map((choice) => choice.emoji)
    expect(emojis[0]).toBe(DEFAULT_AVATAR)
    expect(new Set(emojis).size).toBe(emojis.length)
    // Le serveur refuse un avatar de plus de 16 unités (AVATAR_MAX)
    for (const emoji of emojis) expect(emoji.length).toBeLessThanOrEqual(16)
  })
})
