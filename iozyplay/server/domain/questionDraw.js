/**
 * Domaine métier pur - Tirage aléatoire des questions d'une partie
 * Aucune dépendance externe. Aucune fonction ne mute ses entrées.
 */

// Nombre maximal de mélanges tentés pour obtenir un ordre différent du précédent
const MAX_RESHUFFLE_ATTEMPTS = 20;

/**
 * Clés d'identité d'une question : son id et son mediaUrl (si présents).
 * Deux questions partageant l'une de ces clés sont considérées comme identiques
 * (cas d'une question rangée dans plusieurs catégories).
 */
function questionKeys(question) {
  const keys = [];
  if (question && question.id != null && question.id !== '') keys.push(`id:${question.id}`);
  if (question && typeof question.mediaUrl === 'string' && question.mediaUrl !== '') {
    keys.push(`url:${question.mediaUrl}`);
  }
  return keys;
}

/**
 * Mélange de Fisher-Yates : renvoie une nouvelle liste, l'entrée n'est pas modifiée.
 * `random` doit renvoyer un nombre dans [0, 1) (injectable pour les tests).
 */
export function shuffle(items, random = Math.random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Retire les doublons (même id ou même mediaUrl), en gardant la première occurrence.
 * Les entrées qui ne sont pas des objets sont ignorées.
 */
export function dedupeQuestions(questions) {
  const seen = new Set();
  const unique = [];
  for (const question of questions || []) {
    if (typeof question !== 'object' || question === null) continue;
    const keys = questionKeys(question);
    if (keys.some(key => seen.has(key))) continue;
    keys.forEach(key => seen.add(key));
    unique.push(question);
  }
  return unique;
}

function sameOrder(a, b) {
  if (a.length !== b.length) return false;
  return a.every((question, index) => {
    if (question === b[index]) return true;
    const keysB = new Set(questionKeys(b[index]));
    return questionKeys(question).some(key => keysB.has(key));
  });
}

/**
 * Tire `count` questions au hasard dans `pool`, dans un ordre aléatoire.
 *
 * - Le pool est dédupliqué (une question ne sort jamais deux fois dans une partie).
 * - `count` est borné à [1, taille du pool] ; absent ou invalide → tout le pool.
 * - `previous` (questions de la partie précédente) : on évite autant que possible
 *   de les reprendre. S'il faut en réutiliser (pool trop petit), on complète avec
 *   elles, et si la sélection est identique on garantit au moins un nouvel ordre.
 */
export function drawQuestions(pool, count, { previous = [], random = Math.random } = {}) {
  const unique = dedupeQuestions(pool);
  if (unique.length === 0) return [];

  const requested = typeof count === 'number' && Number.isFinite(count)
    ? Math.round(count)
    : unique.length;
  const size = Math.min(unique.length, Math.max(1, requested));

  const previousKeys = new Set((previous || []).flatMap(questionKeys));
  const isPrevious = question => questionKeys(question).some(key => previousKeys.has(key));
  const fresh = unique.filter(question => !isPrevious(question));
  const reused = unique.filter(isPrevious);

  // Priorité aux questions non jouées, complétées si besoin par des questions déjà jouées
  const selection = [
    ...shuffle(fresh, random).slice(0, size),
    ...shuffle(reused, random).slice(0, Math.max(0, size - fresh.length))
  ];

  // Mélange final : les questions déjà jouées ne restent pas groupées en fin de partie
  let result = shuffle(selection, random);

  // Même sélection que la partie précédente : au minimum un ordre différent
  const prev = previous || [];
  for (let attempt = 0; result.length > 1 && attempt < MAX_RESHUFFLE_ATTEMPTS && sameOrder(result, prev); attempt++) {
    result = shuffle(selection, random);
  }
  if (result.length > 1 && sameOrder(result, prev)) {
    // Filet de sécurité (aléa dégénéré) : rotation d'un cran
    result = [...result.slice(1), result[0]];
  }

  return result;
}
