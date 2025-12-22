/**
 * Repository pour la gestion des salons en mémoire
 * En production, pourrait être remplacé par Redis ou une base de données
 */

class RoomRepository {
    constructor() {
        this.rooms = new Map();
        this.gracePeriodTimers = new Map(); // Map<roomCode, Map<playerId, timer>>
        this.gameTimers = new Map(); // Map<roomCode, timer> pour les timers de jeu
    }

    /**
     * Crée un nouveau salon
     */
    create(room) {
        this.rooms.set(room.code, room);
        return room;
    }

    /**
     * Récupère un salon par son code
     */
    get(roomCode) {
        return this.rooms.get(roomCode);
    }

    /**
     * Met à jour un salon
     */
    update(roomCode, room) {
        this.rooms.set(roomCode, room);
        return room;
    }

    /**
     * Supprime un salon et nettoie ses timers
     */
    delete(roomCode) {
        this.clearGracePeriodTimers(roomCode);
        this.clearGameTimer(roomCode);
        return this.rooms.delete(roomCode);
    }

    /**
     * Démarre un timer de grace period pour un joueur déconnecté
     */
    startGracePeriod(roomCode, playerId, callback, delayMs = 20000) {
        if (!this.gracePeriodTimers.has(roomCode)) {
            this.gracePeriodTimers.set(roomCode, new Map());
        }
        
        const roomTimers = this.gracePeriodTimers.get(roomCode);
        
        // Annuler le timer existant si présent
        if (roomTimers.has(playerId)) {
            clearTimeout(roomTimers.get(playerId));
        }
        
        const timer = setTimeout(() => {
            roomTimers.delete(playerId);
            if (roomTimers.size === 0) {
                this.gracePeriodTimers.delete(roomCode);
            }
            callback();
        }, delayMs);
        
        roomTimers.set(playerId, timer);
    }

    /**
     * Annule le timer de grace period pour un joueur (reconnecté)
     */
    cancelGracePeriod(roomCode, playerId) {
        const roomTimers = this.gracePeriodTimers.get(roomCode);
        if (roomTimers && roomTimers.has(playerId)) {
            clearTimeout(roomTimers.get(playerId));
            roomTimers.delete(playerId);
            if (roomTimers.size === 0) {
                this.gracePeriodTimers.delete(roomCode);
            }
        }
    }

    /**
     * Nettoie tous les timers de grace period pour une room
     */
    clearGracePeriodTimers(roomCode) {
        const roomTimers = this.gracePeriodTimers.get(roomCode);
        if (roomTimers) {
            roomTimers.forEach(timer => clearTimeout(timer));
            this.gracePeriodTimers.delete(roomCode);
        }
    }

    /**
     * Définit un timer de jeu pour une room
     */
    setGameTimer(roomCode, timer) {
        // Annuler le timer existant
        this.clearGameTimer(roomCode);
        this.gameTimers.set(roomCode, timer);
    }

    /**
     * Nettoie le timer de jeu pour une room
     */
    clearGameTimer(roomCode) {
        const timer = this.gameTimers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
            this.gameTimers.delete(roomCode);
        }
    }

    /**
     * Récupère tous les salons
     */
    getAll() {
        return Array.from(this.rooms.values());
    }

    /**
     * Vérifie si un salon existe
     */
    exists(roomCode) {
        return this.rooms.has(roomCode);
    }

    /**
     * Trouve un salon contenant un joueur spécifique (par socketId ou playerId)
     */
    findByPlayer(socketIdOrPlayerId) {
        for (const [roomCode, room] of this.rooms.entries()) {
            if (room.players.some(p => p.id === socketIdOrPlayerId || p.socketId === socketIdOrPlayerId)) {
                return { roomCode, room };
            }
        }
        return null;
    }

    /**
     * Trouve tous les salons contenant un joueur spécifique (par socketId ou playerId)
     */
    findAllByPlayer(socketIdOrPlayerId) {
        const results = [];
        for (const [roomCode, room] of this.rooms.entries()) {
            if (room.players.some(p => p.id === socketIdOrPlayerId || p.socketId === socketIdOrPlayerId)) {
                results.push({ roomCode, room });
            }
        }
        return results;
    }
}

// Instance singleton
export const roomRepository = new RoomRepository();





