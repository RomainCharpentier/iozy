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
 * Durée du média (secondes) valide : nombre > 0 et ≤ START_TIME_MAX
 */
export function isValidDuration(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= START_TIME_MAX;
}

/**
 * Copie de la question sans `duration` invalide (le client se rabat alors sur la durée
 * lue par le lecteur)
 */
export function sanitizeQuestionDuration(question) {
  if (question === null || typeof question !== 'object' || !('duration' in question)) {
    return question;
  }
  if (isValidDuration(question.duration)) return question;
  const { duration: _invalidDuration, ...rest } = question;
  return rest;
}

/**
 * Applique sanitizeQuestionStartTime (et la validation de `duration`) à une liste de questions
 */
export function sanitizeQuestionsStartTime(questions) {
  return Array.isArray(questions)
    ? questions.map((question) => sanitizeQuestionDuration(sanitizeQuestionStartTime(question)))
    : questions;
}

/**
 * Durée d'une vidéo (secondes) lue dans le HTML de sa page YouTube (`"lengthSeconds":"213"`).
 * Retourne null si absente (vidéo inexistante, privée, page inattendue).
 */
export function parseYouTubeLengthSeconds(html) {
  if (typeof html !== 'string') return null;
  const match = html.match(/"lengthSeconds":"(\d+)"/);
  if (!match) return null;
  const seconds = Number(match[1]);
  return isValidDuration(seconds) ? seconds : null;
}

/**
 * Départ aléatoire de l'extrait : le serveur ne connaît pas la durée des vidéos, il tire
 * donc une fraction dans [0, 1) par question et par partie. Chaque client la convertit en
 * secondes une fois la durée connue (startTime ≤ départ ≤ durée − chrono, voir
 * src/utils/timecode.ts) : même vidéo, même durée → même passage pour tous les joueurs.
 * Retourne des copies ; une fraction reçue du client est remplacée.
 */
export function withStartFractions(questions, random = Math.random) {
  if (!Array.isArray(questions)) return questions;
  return questions.map((question) => {
    if (question === null || typeof question !== 'object') return question;
    const fraction = Math.min(0.9999, Math.max(0, Math.floor(random() * 10000) / 10000));
    return { ...question, startFraction: fraction };
  });
}
