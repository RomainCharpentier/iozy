/**
 * Value Objects - Objets de valeur immutables
 */

export type GameMode = 'solo' | 'online'

export type Category = 'series' | 'animes' | 'chansons' | 'films' | 'jeux'

export type MediaType = 'audio' | 'image' | 'video'

export interface CategoryInfo {
  id: Category
  name: string
  emoji: string
}

/**
 * Value Object : Score
 */
export class Score {
  constructor(
    public readonly value: number,
    public readonly total: number
  ) {
    if (value < 0) throw new Error('Score cannot be negative')
    if (total < 0) throw new Error('Total cannot be negative')
    if (value > total) throw new Error('Score cannot exceed total')
  }

  /**
   * Calcule le pourcentage
   */
  getPercentage(): number {
    if (this.total === 0) return 0
    return Math.round((this.value / this.total) * 100)
  }

  /**
   * Vérifie si le score est parfait
   */
  isPerfect(): boolean {
    return this.value === this.total && this.total > 0
  }

  /**
   * Crée un nouveau score avec une valeur incrémentée
   */
  increment(): Score {
    return new Score(this.value + 1, this.total)
  }

  /**
   * Crée un nouveau score réinitialisé
   */
  reset(): Score {
    return new Score(0, this.total)
  }
}

/**
 * Value Object : Progress
 */
export class Progress {
  constructor(
    public readonly current: number,
    public readonly total: number
  ) {
    if (current < 0) throw new Error('Current cannot be negative')
    if (total < 0) throw new Error('Total cannot be negative')
    if (current > total) throw new Error('Current cannot exceed total')
  }

  /**
   * Calcule le pourcentage de progression
   */
  getPercentage(): number {
    if (this.total === 0) return 0
    return ((this.current + 1) / this.total) * 100
  }

  /**
   * Vérifie si la progression est terminée
   */
  isFinished(): boolean {
    return this.current >= this.total - 1
  }

  /**
   * Vérifie si on peut passer à l'élément suivant
   */
  canGoToNext(): boolean {
    return this.current + 1 < this.total
  }

  /**
   * Crée une nouvelle progression pour l'élément suivant
   */
  next(): Progress {
    return new Progress(this.current + 1, this.total)
  }
}




