/**
 * Gestionnaires d'API REST pour les profils de joueurs
 */

import { getProfile, saveProfile, deleteProfile } from '../infrastructure/profileRepository.js';

/**
 * GET /api/profile/:playerId - Récupère un profil par son playerId
 */
export async function getProfileHandler(req, res) {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({ error: 'playerId est requis' });
    }
    
    const profile = await getProfile(playerId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profil non trouvé' });
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération du profil' });
  }
}

/**
 * POST /api/profile - Crée ou met à jour un profil
 */
export async function createOrUpdateProfileHandler(req, res) {
  try {
    const profile = req.body;
    
    // Validation
    if (!profile.playerId || typeof profile.playerId !== 'string') {
      return res.status(400).json({ error: 'playerId est requis et doit être une chaîne' });
    }
    
    // Validation username (optionnel mais doit être string si présent)
    if (profile.username !== undefined && typeof profile.username !== 'string') {
      return res.status(400).json({ error: 'username doit être une chaîne' });
    }
    
    // Validation avatar (optionnel mais doit être string si présent)
    if (profile.avatar !== undefined && typeof profile.avatar !== 'string') {
      return res.status(400).json({ error: 'avatar doit être une chaîne' });
    }
    
    // Limiter la longueur du username
    if (profile.username && profile.username.length > 50) {
      return res.status(400).json({ error: 'username ne doit pas dépasser 50 caractères' });
    }
    
    const savedProfile = await saveProfile({
      playerId: profile.playerId,
      username: profile.username || '',
      avatar: profile.avatar || '🎮'
    });
    
    res.json(savedProfile);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du profil:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la sauvegarde du profil' });
  }
}

/**
 * DELETE /api/profile/:playerId - Supprime un profil
 */
export async function deleteProfileHandler(req, res) {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({ error: 'playerId est requis' });
    }
    
    const deleted = await deleteProfile(playerId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Profil non trouvé' });
    }
    
    res.json({ message: 'Profil supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du profil:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression du profil' });
  }
}



