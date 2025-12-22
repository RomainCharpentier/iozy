/**
 * Gestion de l'identité persistante du joueur
 * Génère et stocke un UUID unique dans localStorage
 */

const PLAYER_ID_KEY = 'blindtest-player-id';

/**
 * Génère un UUID v4
 */
function generateUUID(): string {
  // Utilise crypto.randomUUID() si disponible (navigateurs modernes)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback pour navigateurs plus anciens
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Récupère ou crée un playerId persistant
 */
export function getPlayerId(): string {
  try {
    let playerId = localStorage.getItem(PLAYER_ID_KEY);
    
    if (!playerId) {
      playerId = generateUUID();
      localStorage.setItem(PLAYER_ID_KEY, playerId);
    }
    
    return playerId;
  } catch (error) {
    // Fallback si localStorage n'est pas disponible
    console.warn('localStorage non disponible, génération d\'un ID temporaire');
    return generateUUID();
  }
}

/**
 * Réinitialise le playerId (utile pour les tests)
 */
export function resetPlayerId(): void {
  try {
    localStorage.removeItem(PLAYER_ID_KEY);
  } catch (error) {
    console.warn('Impossible de réinitialiser le playerId');
  }
}

