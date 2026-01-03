/**
 * Service pour gérer les profils de joueurs côté backend
 */

import { getPlayerId } from '../utils/playerId'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

export interface PlayerProfile {
  playerId: string
  username: string
  avatar: string
  createdAt?: string
  updatedAt?: string
}

class ProfileService {
  /**
   * Récupère le profil du joueur actuel depuis le serveur
   */
  static async getProfile(playerId?: string): Promise<PlayerProfile | null> {
    try {
      const id = playerId || getPlayerId()
      const response = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(id)}`)
      
      if (response.status === 404) {
        return null
      }
      
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du profil')
      }
      
      return await response.json()
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error)
      return null
    }
  }

  /**
   * Crée ou met à jour le profil du joueur actuel
   */
  static async saveProfile(profile: { username?: string; avatar?: string }, playerId?: string): Promise<PlayerProfile> {
    try {
      const id = playerId || getPlayerId()
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: id,
          username: profile.username || '',
          avatar: profile.avatar || '🎮'
        })
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erreur lors de la sauvegarde du profil' }))
        throw new Error(error.error || 'Erreur lors de la sauvegarde du profil')
      }
      
      return await response.json()
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du profil:', error)
      throw error
    }
  }

  /**
   * Supprime le profil du joueur actuel
   */
  static async deleteProfile(playerId?: string): Promise<void> {
    try {
      const id = playerId || getPlayerId()
      const response = await fetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erreur lors de la suppression du profil' }))
        throw new Error(error.error || 'Erreur lors de la suppression du profil')
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du profil:', error)
      throw error
    }
  }
}

export default ProfileService



