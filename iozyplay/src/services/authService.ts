/**
 * Service pour gérer l'authentification et les sessions
 */

import { getPlayerId } from '@/utils/playerId'
import ProfileService, { type PlayerProfile } from '@/services/profileService'

const AUTH_KEY = 'blindtest-auth'

export interface AuthSession {
  playerId: string
  username: string
  avatar: string
  createdAt: number // Timestamp
}

class AuthService {
  private session: AuthSession | null = null

  constructor() {
    this.loadSession()
  }

  /**
   * Charge la session depuis localStorage
   */
  private loadSession(): AuthSession | null {
    try {
      const stored = localStorage.getItem(AUTH_KEY)
      if (stored) {
        this.session = JSON.parse(stored)
        return this.session
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la session:', error)
    }
    return null
  }

  /**
   * Sauvegarde la session dans localStorage
   */
  private saveSession(session: AuthSession): void {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(session))
      this.session = session
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la session:', error)
    }
  }

  /**
   * Crée un nouveau compte
   */
  async createAccount(username: string): Promise<AuthSession> {
    const playerId = getPlayerId()

    // Sauvegarder le profil côté backend
    try {
      await ProfileService.saveProfile(
        {
          username: username.trim(),
        },
        playerId
      )
    } catch (error) {
      console.error('Erreur lors de la création du profil backend:', error)
      // Continuer même si le backend échoue
    }

    const session: AuthSession = {
      playerId,
      username: username.trim(),
      avatar: '🎮', // Avatar par défaut
      createdAt: Date.now(),
    }

    this.saveSession(session)
    return session
  }

  /**
   * Connecte un utilisateur existant
   */
  async login(playerId: string): Promise<AuthSession | null> {
    // Récupérer le profil depuis le backend
    try {
      const profile = await ProfileService.getProfile(playerId)
      if (profile && profile.username) {
        const session: AuthSession = {
          playerId: profile.playerId,
          username: profile.username,
          avatar: profile.avatar || '🎮',
          createdAt: Date.now(), // On met à jour la date de connexion
        }

        this.saveSession(session)
        return session
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error)
    }

    return null
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    try {
      localStorage.removeItem(AUTH_KEY)
      // Ne pas supprimer le playerId (géré par playerId.ts) pour garder la persistance
      this.session = null
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
    }
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isAuthenticated(): boolean {
    return this.session !== null && this.session.username.length > 0
  }

  /**
   * Récupère la session actuelle
   */
  getSession(): AuthSession | null {
    if (!this.session) {
      this.loadSession()
    }
    return this.session
  }

  /**
   * Récupère le playerId de la session
   */
  getPlayerId(): string | null {
    return this.session?.playerId || null
  }

  /**
   * Initialise la session au démarrage (tente de se reconnecter automatiquement)
   */
  async init(): Promise<boolean> {
    // Vérifier d'abord si une session existe déjà
    if (this.isAuthenticated()) {
      return true
    }

    // Tenter de se reconnecter avec le playerId existant
    const playerId = getPlayerId()
    if (playerId) {
      const session = await this.login(playerId)
      return session !== null
    }

    return false
  }
}

export const authService = new AuthService()
