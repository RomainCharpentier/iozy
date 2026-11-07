import { describe, it, expect, beforeEach } from 'vitest'
import { getSavedUsername, pickPlayerName } from '@/utils/playerName'
import { settingsService } from '@/services/settingsService'

describe('playerName', () => {
  it('retourne le premier nom non vide, nettoyé', () => {
    expect(pickPlayerName(undefined, '  ', ' Invite ', 'Autre')).toBe('Invite')
  })

  it('retourne undefined sans aucun nom exploitable (jamais de nom par défaut)', () => {
    expect(pickPlayerName()).toBeUndefined()
    expect(pickPlayerName(null, undefined, '', '   ')).toBeUndefined()
  })

  describe('getSavedUsername', () => {
    beforeEach(() => {
      settingsService.saveSettings({ username: '' })
    })

    it('lit le nom enregistré dans les réglages', () => {
      settingsService.saveSettings({ username: ' Alice ' })
      expect(getSavedUsername()).toBe('Alice')
    })

    it('retourne undefined si aucun nom enregistré', () => {
      expect(getSavedUsername()).toBeUndefined()
    })
  })
})
