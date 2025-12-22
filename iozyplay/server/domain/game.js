/**
 * Domaine métier pur - Logique de jeu
 * Aucune dépendance externe
 */

/**
 * Démarre une partie dans un salon
 */
export function startGame(room, questions, defaultTimeLimit) {
    if (!room) return null;

    room.questions = questions;
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    room.defaultTimeLimit = defaultTimeLimit || room.defaultTimeLimit || 5;
    room.updatedAt = Date.now();

    // Initialiser l'état de jeu avec la première question
    const currentQuestion = questions[0];
    const durationMs = (currentQuestion?.timeLimit || room.defaultTimeLimit) * 1000;
    
    room.game = {
        questionIndex: 0,
        startedAt: null, // Sera défini au moment du "go"
        goAt: null, // Timestamp du signal "go"
        durationMs: durationMs,
        answers: {}, // { playerId: answer }
        readyPlayers: new Set() // Set des playerIds prêts
    };

    return room;
}

/**
 * Relance une partie avec de nouvelles catégories
 */
export function restartGameWithCategories(room, questions, categories, defaultTimeLimit) {
    if (!room) return null;

    room.questions = questions;
    room.categories = categories;
    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    room.defaultTimeLimit = defaultTimeLimit || room.defaultTimeLimit || 5;
    room.updatedAt = Date.now();

    // Réinitialiser les scores
    room.players.forEach(player => {
        player.score = 0;
    });

    // Réinitialiser l'état de jeu
    const currentQuestion = questions[0];
    const durationMs = (currentQuestion?.timeLimit || room.defaultTimeLimit) * 1000;
    
    room.game = {
        questionIndex: 0,
        startedAt: null, // Sera défini au moment du "go"
        goAt: null,
        durationMs: durationMs,
        answers: {},
        readyPlayers: new Set()
    };

    return room;
}

/**
 * Relance une partie avec les mêmes questions
 */
export function restartGame(room) {
    if (!room) return null;

    room.currentQuestionIndex = 0;
    room.gameState = 'playing';
    room.updatedAt = Date.now();

    // Réinitialiser les scores
    room.players.forEach(player => {
        player.score = 0;
    });

    // Réinitialiser l'état de jeu
    if (room.questions && room.questions.length > 0) {
        const currentQuestion = room.questions[0];
        const durationMs = (currentQuestion?.timeLimit || room.defaultTimeLimit) * 1000;
        
        room.game = {
            questionIndex: 0,
            startedAt: null, // Sera défini au moment du "go"
            goAt: null,
            durationMs: durationMs,
            answers: {},
            readyPlayers: new Set()
        };
    }

    return room;
}

/**
 * Vérifie une réponse d'un joueur
 */
export function checkAnswer(room, socketId, answer) {
    if (!room || room.gameState !== 'playing') return { isValid: false };

    const player = room.players.find(p => p.socketId === socketId || p.id === socketId);
    if (!player) return { isValid: false };

    const currentQuestion = room.questions[room.currentQuestionIndex];
    if (!currentQuestion) return { isValid: false };

    // Enregistrer la réponse
    if (room.game) {
        room.game.answers[player.id] = answer;
    }

    const isCorrect = answer.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim();

    if (isCorrect) {
        player.score += 1;
        room.updatedAt = Date.now();
        return {
            isValid: true,
            isCorrect: true,
            player,
            currentQuestion
        };
    }

    return {
        isValid: true,
        isCorrect: false,
        player,
        currentQuestion
    };
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
    const currentQuestion = room.questions[room.currentQuestionIndex];
    const durationMs = (currentQuestion?.timeLimit || room.defaultTimeLimit) * 1000;
    
    room.game = {
        questionIndex: room.currentQuestionIndex,
        startedAt: null, // Sera défini au moment du "go"
        goAt: null, // Timestamp du signal "go"
        durationMs: durationMs,
        answers: {},
        readyPlayers: new Set() // Réinitialiser pour la nouvelle question
    };

    return {
        room,
        isFinished: false,
        currentQuestion: currentQuestion,
        questionIndex: room.currentQuestionIndex
    };
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


