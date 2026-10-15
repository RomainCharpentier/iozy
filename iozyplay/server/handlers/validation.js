/**
 * Helpers de validation des payloads Socket.io entrants
 * Objectif : qu'un payload mal formé ne fasse jamais planter le serveur
 */

export const INVALID_PAYLOAD = 'INVALID_PAYLOAD';

// Bornes alignées sur le client (src/services/gameService.ts, TIMING), avec une marge haute
export const TIME_LIMIT = {
  DEFAULT: 5,
  MIN: 5,
  MAX: 120
};

export const LIMITS = {
  ROOM_CODE_MAX: 16,
  PLAYER_ID_MAX: 128,
  PLAYER_NAME_MAX: 30,
  AVATAR_MAX: 16,
  ANSWER_MAX: 200,
  QUESTIONS_MAX: 500,
  CATEGORIES_MAX: 100
};

const ROOM_CODE_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Envoie une erreur INVALID_PAYLOAD au client
 */
export function sendInvalidPayload(socket, message = 'Payload invalide') {
  socket.emit('error', { code: INVALID_PAYLOAD, message });
}

/**
 * Vérifie qu'une valeur est un objet simple (ni null, ni tableau)
 */
export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Code de salon : chaîne alphanumérique non vide de longueur raisonnable
 */
export function isValidRoomCode(roomCode) {
  return typeof roomCode === 'string'
    && roomCode.length > 0
    && roomCode.length <= LIMITS.ROOM_CODE_MAX
    && ROOM_CODE_REGEX.test(roomCode);
}

/**
 * Identifiant de joueur : chaîne non vide de longueur raisonnable
 */
export function isValidPlayerId(playerId) {
  return typeof playerId === 'string'
    && playerId.trim().length > 0
    && playerId.length <= LIMITS.PLAYER_ID_MAX;
}

/**
 * Normalise un nom de joueur.
 * - undefined/null/chaîne vide → fallback
 * - non-string → null (invalide)
 * - chaîne → trim + tronquée à PLAYER_NAME_MAX
 */
export function normalizePlayerName(name, fallback) {
  if (name === undefined || name === null) return fallback;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, LIMITS.PLAYER_NAME_MAX).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Normalise un avatar : chaîne courte, sinon fallback
 */
export function normalizeAvatar(avatar, fallback) {
  if (typeof avatar !== 'string') return fallback;
  const trimmed = avatar.trim();
  return trimmed.length > 0 && trimmed.length <= LIMITS.AVATAR_MAX ? trimmed : fallback;
}

/**
 * Normalise une limite de temps (en secondes).
 * Valeur absente ou non numérique → défaut ; sinon arrondie et bornée.
 */
export function normalizeTimeLimit(value, fallback = TIME_LIMIT.DEFAULT) {
  const base = Number.isFinite(fallback) ? fallback : TIME_LIMIT.DEFAULT;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return Math.min(TIME_LIMIT.MAX, Math.max(TIME_LIMIT.MIN, Math.round(base)));
  }
  return Math.min(TIME_LIMIT.MAX, Math.max(TIME_LIMIT.MIN, Math.round(value)));
}

/**
 * Questions : tableau d'objets de taille bornée
 * (le cas tableau vide est géré séparément avec NO_QUESTIONS)
 */
export function isValidQuestionList(questions) {
  return Array.isArray(questions)
    && questions.length <= LIMITS.QUESTIONS_MAX
    && questions.every(isPlainObject);
}

/**
 * Catégories : absentes ou tableau de taille bornée
 */
export function isValidCategories(categories) {
  return categories === undefined
    || categories === null
    || (Array.isArray(categories) && categories.length <= LIMITS.CATEGORIES_MAX);
}

/**
 * Normalise une réponse : chaîne tronquée, sinon null (invalide)
 */
export function normalizeAnswerInput(answer) {
  if (typeof answer !== 'string') return null;
  return answer.slice(0, LIMITS.ANSWER_MAX);
}

/**
 * Enveloppe un handler Socket.io :
 * - rejette (INVALID_PAYLOAD) tout payload qui n'est pas un objet simple ;
 * - intercepte les exceptions synchrones et les promesses rejetées pour ne jamais tuer le process.
 */
export function withPayload(socket, eventName, handler) {
  return (payload, ...rest) => {
    if (!isPlainObject(payload)) {
      console.warn(`[${eventName}] Payload invalide reçu`, { socketId: socket.id });
      sendInvalidPayload(socket);
      return;
    }
    try {
      const result = handler(payload, ...rest);
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          console.error(`[${eventName}] Erreur dans le handler :`, error);
        });
      }
    } catch (error) {
      console.error(`[${eventName}] Erreur dans le handler :`, error);
    }
  };
}

/**
 * Enveloppe le callback d'un timer de jeu dans un try/catch
 * pour qu'une erreur ne tue jamais le process.
 */
export function safeTimerCallback(label, callback) {
  return () => {
    try {
      callback();
    } catch (error) {
      console.error(`[${label}] Erreur dans le timer :`, error);
    }
  };
}
