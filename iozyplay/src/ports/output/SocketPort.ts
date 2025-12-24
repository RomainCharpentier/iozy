/**
 * Output Port : SocketPort
 * Interface pour la communication socket (Hexagonal Architecture)
 */
export interface SocketEvent {
  event: string
  data?: any
}

export interface SocketPort {
  /**
   * Émet un événement
   */
  emit(event: string, data?: any): void

  /**
   * Écoute un événement
   */
  on(event: string, callback: (data?: any) => void): void

  /**
   * Arrête d'écouter un événement
   */
  off(event: string, callback?: (data?: any) => void): void

  /**
   * Vérifie si le socket est connecté
   */
  isConnected(): boolean

  /**
   * Se connecte
   */
  connect(): void

  /**
   * Se déconnecte
   */
  disconnect(): void
}




