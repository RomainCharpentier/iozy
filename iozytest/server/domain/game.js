/**
 * Domaine métier pur - Logique de jeu
 * Aucune dépendance externe
 */

import { compareAnswers, normalizeAnswer } from './answerUtils.js';
import { dedupeQuestions, drawQuestions } from './questionDraw.js';
import { withStartFractions } from './questionMedia.js';

// Durée par défaut d'une question (secondes), alignée sur TIME_LIMIT.DEFAULT (handlers/validation.js)
const DEFAULT_TIME_LIMIT = 20;

// Transition minimale entre deux questions (ms) : écran « Question N sur M » côté client,
// pendant lequel l'extrait suivant se charge. Le « go » n'est pas donné avant sa fin.
export const QUESTION_TRANSITION_MS = 3000;

/**
 * Enregistre le pool de questions de la room et tire la sélection de la partie.
 * - `questionCount` absent (null/undefined) : on garde toutes les questions reçues, dans l'ordre
 *   (compatibilité : l'hôte envoie alors une liste déjà tirée).
 * - Sinon : tirage aléatoire de `questionCount` questions dans le pool (dédupliqué).
 * Le pool complet (avec les réponses) reste côté serveur pour les « Rejouer ».
 */
function setQuestionPool(room, questions, questionCount, previous = []) {
    const pool = dedupeQuestions(questions);
    room.questionPool = pool;
    const selection = questionCount == null ? pool : drawQuestions(pool, questionCount, { previous });
    // Nouveau point de départ aléatoire pour chaque question, à chaque partie
    room.questions = withStartFractions(selection);
    room.questionCount = room.questions.length;
}

/**
 * Démarre une partie dans un salon
 */
export function startGame(room, questions, defaultTimeLimit, questionCount = null) {
    if (!room) return null;

    setQuestionPool(room, questions, questionCount);
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    room.defaultTimeLimit = defaultTimeLimit || room.defaultTimeLimit || DEFAULT_TIME_LIMIT;
    room.updatedAt = Date.now();

    // Initialiser l'état de jeu avec la première question
    // TOUJOURS utiliser room.defaultTimeLimit pour garantir une durée cohérente
    const durationMs = room.defaultTimeLimit * 1000;

    room.game = {
        questionIndex: 0,
        startedAt: null, // Sera défini au moment du "go"
        goAt: null, // Timestamp du signal "go"
        durationMs: durationMs,
        answers: {}, // { playerId: answer } - réponses stockées, non validées
        readyPlayers: new Set(), // Set des playerIds prêts
        skipVotes: new Set(), // Set des playerIds qui ont voté skip
        validatedAnswers: {} // { playerId: isCorrect } - réponses validées à la fin du guess
    };

    return room;
}

/**
 * Relance une partie avec de nouvelles catégories
 */
export function restartGameWithCategories(room, questions, categories, defaultTimeLimit, questionCount = null) {
    if (!room) return null;

    // Comme « Rejouer » : on évite autant que possible les questions de la partie précédente
    setQuestionPool(room, questions, questionCount, room.questions || []);
    room.categories = categories;
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    room.defaultTimeLimit = defaultTimeLimit || room.defaultTimeLimit || DEFAULT_TIME_LIMIT;
    room.updatedAt = Date.now();

    // Réinitialiser les scores
    room.players.forEach(player => {
        player.score = 0;
    });

    // Réinitialiser l'état de jeu
    // TOUJOURS utiliser room.defaultTimeLimit pour garantir une durée cohérente
    const durationMs = room.defaultTimeLimit * 1000;

    room.game = {
        questionIndex: 0,
        startedAt: null, // Sera défini au moment du "go"
        goAt: null,
        durationMs: durationMs,
        answers: {},
        readyPlayers: new Set(),
        skipVotes: new Set(),
        validatedAnswers: {}
    };

    return room;
}

/**
 * Relance une partie dans les mêmes catégories, avec un nouveau tirage :
 * même nombre de questions, en évitant autant que possible celles de la partie précédente,
 * et au minimum dans un nouvel ordre.
 */
export function restartGame(room) {
    if (!room) return null;

    if (room.questions && room.questions.length > 0) {
        const pool = room.questionPool && room.questionPool.length > 0 ? room.questionPool : room.questions;
        const count = room.questionCount || room.questions.length;
        room.questions = withStartFractions(drawQuestions(pool, count, { previous: room.questions }));
    }

    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    room.updatedAt = Date.now();

    // Réinitialiser les scores
    room.players.forEach(player => {
        player.score = 0;
    });

    // Réinitialiser l'état de jeu
    if (room.questions && room.questions.length > 0) {
        // TOUJOURS utiliser room.defaultTimeLimit pour garantir une durée cohérente
        const durationMs = room.defaultTimeLimit * 1000;

        room.game = {
            questionIndex: 0,
            startedAt: null, // Sera défini au moment du "go"
            goAt: null,
            durationMs: durationMs,
            answers: {},
            readyPlayers: new Set(),
            skipVotes: new Set(),
            validatedAnswers: {}
        };
    }

    return room;
}

/**
 * Stocke une réponse d'un joueur (sans la valider)
 */
export function storeAnswer(room, socketId, answer) {
    if (!room || room.gameState !== 'playing') return { isValid: false };

    const player = room.players.find(p => p.socketId === socketId || p.id === socketId);
    if (!player) return { isValid: false };

    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!currentQuestion) return { isValid: false };

    // Enregistrer la réponse sans la valider
    if (room.game) {
        room.game.answers[player.id] = answer;
    }

    room.updatedAt = Date.now();
    return {
        isValid: true,
        player,
        currentQuestion
    };
}

/**
 * Valide toutes les réponses stockées (appelé à la fin du guess)
 */
export function validateAnswers(room) {
    if (!room || room.gameState !== 'playing' || !room.game) return { validated: false };

    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!currentQuestion) return { validated: false };

    const validatedAnswers = {};
    const correctPlayers = [];

    // Valider toutes les réponses stockées
    for (const [playerId, answer] of Object.entries(room.game.answers)) {
        // Utiliser la fonction de normalisation pour gérer les accents et caractères spéciaux
        const isCorrect = compareAnswers(answer, currentQuestion.answer);

        // Log pour déboguer
        if (!isCorrect) {
            const normalizedUser = normalizeAnswer(answer);
            const normalizedCorrect = normalizeAnswer(currentQuestion.answer);
            // Calculer la distance pour le debug
            const maxLength = Math.max(normalizedUser.length, normalizedCorrect.length);
            const distance = normalizedUser.length !== normalizedCorrect.length
                ? Math.abs(normalizedUser.length - normalizedCorrect.length)
                : Array.from(normalizedUser).filter((char, i) => char !== normalizedCorrect[i]).length;
            console.log('[validateAnswers] Réponse incorrecte:', {
                playerId,
                userAnswer: answer,
                correctAnswer: currentQuestion.answer,
                normalizedUser,
                normalizedCorrect,
                distance,
                maxLength,
                maxAllowedDistance: maxLength <= 5 ? 1 : Math.max(1, Math.floor(maxLength * 0.1))
            });
        }

        validatedAnswers[playerId] = isCorrect;

        if (isCorrect) {
            const player = room.players.find(p => p.id === playerId);
            if (player) {
                player.score += 1;
                correctPlayers.push(player);
            }
        }
    }

    // Marquer que les réponses ont été validées (même si validatedAnswers est vide)
    validatedAnswers._validated = true;
    room.game.validatedAnswers = validatedAnswers;
    room.updatedAt = Date.now();

    return {
        validated: true,
        validatedAnswers,
        correctPlayers,
        players: room.players
    };
}

/**
 * Vérifie une réponse d'un joueur (fonction legacy, maintenant on utilise storeAnswer + validateAnswers)
 * @deprecated Utiliser storeAnswer + validateAnswers à la place
 */
export function checkAnswer(room, socketId, answer) {
    // Pour compatibilité, on stocke et valide immédiatement
    const storeResult = storeAnswer(room, socketId, answer);
    if (!storeResult.isValid) return { isValid: false };

    const currentQuestion = room.questions[room.currentQuestionIndex];
    // Utiliser la fonction de normalisation pour gérer les accents et caractères spéciaux
    const isCorrect = compareAnswers(answer, currentQuestion.answer);

    if (isCorrect) {
        const player = room.players.find(p => p.socketId === socketId || p.id === socketId);
        if (player) {
            player.score += 1;
        }
        room.updatedAt = Date.now();
        return {
            isValid: true,
            isCorrect: true,
            player: storeResult.player,
            currentQuestion
        };
    }

    return {
        isValid: true,
        isCorrect: false,
        player: storeResult.player,
        currentQuestion
    };
}

/**
 * Vote pour skip (tous doivent voter pour que ça skip)
 */
export function voteSkip(room, socketId) {
    if (!room || room.gameState !== 'playing' || !room.game) {
        return { voted: false };
    }

    const player = room.players.find(p => p.socketId === socketId || p.id === socketId);
    if (!player) {
        return { voted: false };
    }

    // Vérifier si le joueur a déjà voté
    if (room.game.skipVotes.has(player.id)) {
        return { voted: false, alreadyVoted: true };
    }

    // Ajouter le vote
    room.game.skipVotes.add(player.id);
    room.updatedAt = Date.now();

    // Tous les joueurs connectés ont voté (comme pour game:ready, un joueur déconnecté
    // ne bloque pas le vote ; le client affiche « X/Y » avec Y = joueurs connectés)
    const connectedPlayers = room.players.filter(p => p.connected !== false);
    const allPlayersVoted = connectedPlayers.length > 0 &&
        connectedPlayers.every(p => room.game.skipVotes.has(p.id));

    return {
        voted: true,
        allPlayersVoted,
        skipVotes: Array.from(room.game.skipVotes)
    };
}

/**
 * Réinitialise les votes skip (appelé au début d'une nouvelle phase/question)
 */
export function resetSkipVotes(room) {
    if (!room || !room.game) return;
    room.game.skipVotes.clear();
    room.updatedAt = Date.now();
}

/**
 * Passe à la question suivante
 */
export function nextQuestion(room) {
    if (!room || room.gameState !== 'playing') return null;

    room.currentQuestionIndex += 1;
    room.updatedAt = Date.now();

    if (room.currentQuestionIndex >= room.questions.length) {
        // Fin de la partie
        room.gameState = 'finished';
        room.game = null; // Nettoyer l'état de jeu
        return {
            room,
            isFinished: true,
            players: [...room.players].sort((a, b) => b.score - a.score)
        };
    }

    // Initialiser l'état de la nouvelle question
    // TOUJOURS utiliser room.defaultTimeLimit pour garantir une durée cohérente
    // (le client devrait avoir appliqué applyDefaultTimeLimit, mais on force quand même)
    const durationMs = room.defaultTimeLimit * 1000;

    room.game = {
        questionIndex: room.currentQuestionIndex,
        startedAt: null, // Sera défini au moment du "go"
        goAt: null, // Timestamp du signal "go"
        // Début du chrono au plus tôt à la fin de la transition entre questions
        transitionUntil: Date.now() + QUESTION_TRANSITION_MS,
        durationMs: durationMs,
        answers: {}, // Réinitialiser pour la nouvelle question
        readyPlayers: new Set(), // Réinitialiser pour la nouvelle question
        skipVotes: new Set(), // Réinitialiser pour la nouvelle question
        validatedAnswers: {} // Réinitialiser pour la nouvelle question
    };

    return {
        room,
        isFinished: false,
        currentQuestion: room.questions[room.currentQuestionIndex],
        questionIndex: room.currentQuestionIndex
    };
}

/**
 * Bonne réponse de la question en cours (à n'envoyer qu'au reveal)
 */
export function getCorrectAnswer(room) {
    if (!room || !room.game || !room.questions) return undefined;
    return room.questions[room.game.questionIndex]?.answer;
}

/**
 * Vérifie si la partie est terminée
 */
export function isGameFinished(room) {
    if (!room || room.gameState !== 'playing') return false;
    return room.currentQuestionIndex >= room.questions.length;
}

/**
 * Récupère l'état actuel du jeu
 */
export function getGameState(room) {
    if (!room) return null;

    if (room.gameState === 'playing' && room.questions && room.questions.length > 0) {
        return {
            gameState: 'playing',
            currentQuestion: room.questions[room.currentQuestionIndex],
            questionIndex: room.currentQuestionIndex,
            players: room.players,
            defaultTimeLimit: room.defaultTimeLimit,
            game: room.game // Inclure startedAt et durationMs
        };
    }

    return {
        gameState: room.gameState || 'waiting'
    };
}


