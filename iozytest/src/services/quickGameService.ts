/**
 * Partie rapide : une partie lancée en un clic depuis « On joue ? », sans
 * passer par le choix des thèmes. Réglages par défaut : toute la banque de
 * questions (tous les thèmes qui en ont) et dix extraits. Le salon
 * reste le même que pour une partie choisie : l'hôte partage le lien et lance.
 */
import type { Category, Question } from '@/types'
import { QuestionService } from '@/services/questionService'

/** Nombre d'extraits d'une partie rapide (borné par la taille de la banque). */
export const QUICK_GAME_QUESTION_COUNT = 10

export interface QuickGameSetup {
  categories: Category[]
  questions: Question[]
  questionCount: number
}

/** Les thèmes présents dans la banque, dans l'ordre où ils apparaissent. */
export function categoriesOf(questions: Question[]): Category[] {
  const seen = new Set<Category>()
  for (const q of questions) {
    const cats = Array.isArray(q.category) ? q.category : [q.category]
    for (const cat of cats) {
      if (cat) seen.add(cat)
    }
  }
  return [...seen]
}

/** Une question sans thème n'est jamais jouée : le salon tire ses questions par thème. */
function hasCategory(question: Question): boolean {
  const cats = Array.isArray(question.category) ? question.category : [question.category]
  return cats.some((cat) => !!cat)
}

/** Les questions qu'une partie peut tirer : dédoublonnées, avec au moins un thème. */
export function playableQuestions(bank: Question[]): Question[] {
  return QuestionService.dedupeQuestions(bank).filter(hasCategory)
}

/**
 * Prépare une partie rapide à partir de la banque : tous les thèmes, dix
 * extraits au plus. `null` quand rien n'est jouable. Les questions ne servent
 * qu'à vérifier qu'il y a de quoi jouer : le salon relit la banque par thème
 * et le serveur tire lui-même les extraits, au hasard.
 */
export function buildQuickGame(bank: Question[]): QuickGameSetup | null {
  const questions = playableQuestions(bank)
  if (questions.length === 0) return null
  return {
    categories: categoriesOf(questions),
    questions,
    questionCount: Math.min(QUICK_GAME_QUESTION_COUNT, questions.length),
  }
}

/** Lit toute la banque ; `null` quand le serveur ne répond pas. */
export async function loadQuestionBank(): Promise<Question[] | null> {
  try {
    return await QuestionService.getAllQuestions()
  } catch {
    return null
  }
}
