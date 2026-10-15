/**
 * Domaine métier pur - Paramètres de lecture du média d'une question
 */

// Borne haute du point de départ d'un extrait (24 h), alignée sur le client (src/utils/timecode.ts)
export const START_TIME_MAX = 86400;

/**
 * Point de départ valide : entier ≥ 0 et ≤ START_TIME_MAX (en secondes)
 */
export function isValidStartTime(value) {
  return Number.isInteger(value) && value >= 0 && value <= START_TIME_MAX;
}

/**
 * Retourne une copie de la question dont le `startTime` est garanti valide :
 * conservé s'il est valide, retiré s'il est invalide (le client démarrera alors à 0
 * ou au `t=` de l'URL). La question d'origine n'est pas modifiée.
 */
export function sanitizeQuestionStartTime(question) {
  if (question === null || typeof question !== 'object' || !('startTime' in question)) {
    return question;
  }
  if (isValidStartTime(question.startTime)) return question;
  const { startTime: _invalidStartTime, ...rest } = question;
  return rest;
}

/**
 * Applique sanitizeQuestionStartTime à une liste de questions
 */
export function sanitizeQuestionsStartTime(questions) {
  return Array.isArray(questions) ? questions.map(sanitizeQuestionStartTime) : questions;
}
