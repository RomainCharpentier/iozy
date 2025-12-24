/**
 * Entité métier : Player
 * Représente un joueur dans le jeu
 */
export interface Player {
  id: string // playerId (UUID persistant)
  name: string
  score: number
  isHost?: boolean
  socketId?: string // socket.id (peut changer à chaque reconnexion)
  connected?: boolean // état de connexion
}

export class PlayerEntity {
  constructor(
    public readonly id: string,
    public name: string,
    public score: number = 0,
    public isHost: boolean = false,
    public socketId?: string,
    public connected: boolean = true
  ) {}

  /**
   * Incrémente le score du joueur
   */
  addScore(points: number = 1): void {
    this.score += points
  }

  /**
   * Réinitialise le score
   */
  resetScore(): void {
    this.score = 0
  }

  /**
   * Met à jour le nom du joueur
   */
  updateName(name: string): void {
    if (name.trim().length > 0) {
      this.name = name.trim()
    }
  }

  /**
   * Met à jour l'état de connexion
   */
  setConnected(connected: boolean, socketId?: string): void {
    this.connected = connected
    if (socketId) {
      this.socketId = socketId
    }
  }

  /**
   * Convertit l'entité en objet simple
   */
  toPlainObject(): Player {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      isHost: this.isHost,
      socketId: this.socketId,
      connected: this.connected
    }
  }

  /**
   * Crée une entité depuis un objet simple
   */
  static fromPlainObject(player: Player): PlayerEntity {
    return new PlayerEntity(
      player.id,
      player.name,
      player.score,
      player.isHost ?? false,
      player.socketId,
      player.connected ?? true
    )
  }
}




