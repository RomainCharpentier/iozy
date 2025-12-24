/**
 * Service de questions - Gestion du stockage et manipulation des questions
 */
import type { Category, Question, QuestionsData } from './types'

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

/**
 * Service de questions - API publique
 */
export class QuestionService {
  /**
   * Récupère toutes les questions pour les catégories sélectionnées
   */
  static async getQuestionsForCategories(categories: Category[]): Promise<Question[]> {
    const allQuestions = await this.getAllQuestions()
    return allQuestions.filter(q => {
      const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
      return questionCategories.some(cat => categories.includes(cat))
    })
  }

  /**
   * Mélange un tableau de questions (algorithme Fisher-Yates)
   */
  static shuffleQuestions(questions: Question[]): Question[] {
    const shuffled = [...questions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  /**
   * Applique un timer par défaut à toutes les questions
   */
  static applyDefaultTimeLimit(questions: Question[], timeLimit: number): Question[] {
    return questions.map(q => ({
      ...q,
      timeLimit: timeLimit
    }))
  }

  /**
   * Génère un ID automatique pour une question
   * Pour les URLs YouTube, utilise l'URL comme ID (clé primaire)
   * Sinon, génère un ID basé sur les catégories
   */
  static async generateId(mediaUrl: string, categories: Category | Category[]): Promise<string> {
    // Pour les URLs YouTube, utiliser l'URL comme ID (clé primaire)
    if (mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
      return mediaUrl
    }

    // Pour les autres médias, générer un ID basé sur la première catégorie
    const categoryArray = Array.isArray(categories) ? categories : [categories]
    const primaryCategory = categoryArray[0]

    const categoryQuestions = await this.getQuestionsByCategory(primaryCategory)
    const existingIds = categoryQuestions.map(q => q.id || q.mediaUrl)
    let counter = 1
    let newId = `${primaryCategory}-${counter}`

    while (existingIds.includes(newId)) {
      counter++
      newId = `${primaryCategory}-${counter}`
    }

    return newId
  }

  /**
   * Récupère toutes les questions
   */
  static async getAllQuestions(): Promise<Question[]> {
    const allData = await this.getAllQuestionsData()
    const all: Question[] = []
    Object.values(allData).forEach(categoryQuestions => {
      all.push(...categoryQuestions)
    })
    return all
  }

  /**
   * Récupère les questions par catégorie
   */
  static async getQuestionsByCategory(category: Category): Promise<Question[]> {
    const allData = await this.getAllQuestionsData()
    return allData[category] || []
  }

  /**
   * Charge les questions depuis le serveur
   */
  static async loadQuestions(): Promise<QuestionsData> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/questions`)
      if (!response.ok) {
        throw new Error('Failed to load questions')
      }
      return await response.json()
    } catch (error) {
      console.error('Erreur lors du chargement des questions:', error)
      return { chansons: [], series: [], animes: [], films: [], jeux: [] }
    }
  }

  /**
   * Sauvegarde toutes les questions sur le serveur (pour compatibilité)
   * Supporte les catégories multiples : une question peut apparaître dans plusieurs catégories
   */
  static async saveQuestions(questions: Question[]): Promise<void> {
    const organized: QuestionsData = {
      chansons: [],
      series: [],
      animes: [],
      films: [],
      jeux: []
    }

    questions.forEach(q => {
      const categories = Array.isArray(q.category) ? q.category : [q.category]
      categories.forEach(cat => {
        if (organized[cat]) {
          // Éviter les doublons : vérifier si la question existe déjà dans cette catégorie
          const exists = organized[cat].some(existing => existing.id === q.id || existing.mediaUrl === q.mediaUrl)
          if (!exists) {
            organized[cat].push(q)
          }
        }
      })
    })

    try {
      const response = await fetch(`${API_BASE_URL}/api/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(organized)
      })
      if (!response.ok) {
        throw new Error('Failed to save questions')
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des questions:', error)
      throw error
    }
  }

  /**
   * Ajoute une question sur le serveur
   */
  static async addQuestion(question: Question): Promise<Question> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(question)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add question')
      }
      return await response.json()
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la question:', error)
      throw error
    }
  }

  /**
   * Supprime une question du serveur
   * Si category est fourni, supprime seulement de cette catégorie
   * Sinon, supprime la question complètement
   */
  static async deleteQuestion(questionId: string, category?: Category): Promise<void> {
    try {
      const url = category
        ? `${API_BASE_URL}/api/questions/${encodeURIComponent(questionId)}?category=${category}`
        : `${API_BASE_URL}/api/questions/${encodeURIComponent(questionId)}`
      const response = await fetch(url, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete question')
      }
    } catch (error) {
      console.error('Erreur lors de la suppression de la question:', error)
      throw error
    }
  }

  /**
   * Récupère toutes les données de questions depuis le serveur
   */
  private static async getAllQuestionsData(): Promise<QuestionsData> {
    return await this.loadQuestions()
  }
}
