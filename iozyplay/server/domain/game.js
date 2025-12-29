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

    const correctAnswer = currentQuestion.answer.toLowerCase().trim();
    const validatedAnswers = {};
    const correctPlayers = [];

    // Valider toutes les réponses stockées
    for (const [playerId, answer] of Object.entries(room.game.answers)) {
        const playerAnswer = answer.toLowerCase().trim();
        const isCorrect = playerAnswer === correctAnswer;
        
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
    const isCorrect = answer.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim();

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

    // Ajouter le vote
    room.game.skipVotes.add(player.id);
    room.updatedAt = Date.now();

    // Vérifier si tous les joueurs ont voté
    const allPlayersVoted = room.players.every(p => room.game.skipVotes.has(p.id));
    
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


