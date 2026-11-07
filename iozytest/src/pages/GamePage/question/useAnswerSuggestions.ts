import { useEffect, useMemo, useState } from 'react'
import type { Category, Question } from '@/types'
import { QuestionService } from '@/services/questionService'

/**
 * Construit une liste de suggestions dédoublonnée et triée (l'ordre ne trahit aucune question).
 */
export function buildSuggestionPool(answers: unknown[]): string[] {
  const unique = new Set<string>()
  for (const answer of answers) {
    if (typeof answer === 'string' && answer.trim()) unique.add(answer.trim())
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b))
}

/**
 * Suggestions d'autocomplétion : réponses de TOUTES les questions des catégories
 * de la partie, récupérées via l'API REST. Les questions reçues du serveur de jeu
 * n'ont plus de champ `answer` avant le reveal, et la liste ne permet pas de savoir
 * quelle réponse correspond à la question en cours.
 */
export function useAnswerSuggestions(questions: Question[]): string[] {
  const categoriesKey = useMemo(() => {
    const categories = new Set<string>()
    for (const q of questions) {
      const cats = Array.isArray(q.category) ? q.category : [q.category]
      cats.forEach((c) => c && categories.add(c))
    }
    return Array.from(categories).sort().join('|')
  }, [questions])

  const [pool, setPool] = useState<string[]>([])

  useEffect(() => {
    if (!categoriesKey) {
      setPool([])
      return
    }
    let cancelled = false
    const categories = categoriesKey.split('|') as Category[]
    QuestionService.getQuestionsForCategories(categories)
      .then((categoryQuestions) => {
        if (!cancelled) setPool(buildSuggestionPool(categoryQuestions.map((q) => q.answer)))
      })
      .catch(() => {
        // Suggestions désactivées si l'API est indisponible
        if (!cancelled) setPool([])
      })
    return () => {
      cancelled = true
    }
  }, [categoriesKey])

  return pool
}
