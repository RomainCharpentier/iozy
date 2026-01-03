/**
 * Repository pour la gestion des profils de joueurs (persistance fichier)
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILES_FILE = path.join(__dirname, '../../data/profiles.json');

/**
 * Charge les profils depuis le fichier
 */
export async function loadProfiles() {
  try {
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(PROFILES_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    const data = await fs.readFile(PROFILES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // S'assurer que c'est un objet (format: { playerId: profile, ... })
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas, retourner structure vide
      return {};
    }
    console.error('Erreur lors du chargement des profils:', error);
    return {};
  }
}

/**
 * Sauvegarde les profils dans le fichier
 */
export async function saveProfiles(profiles) {
  try {
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(PROFILES_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des profils:', error);
    throw error;
  }
}

/**
 * Récupère un profil par son playerId
 */
export async function getProfile(playerId) {
  const profiles = await loadProfiles();
  return profiles[playerId] || null;
}

/**
 * Crée ou met à jour un profil
 */
export async function saveProfile(profile) {
  const profiles = await loadProfiles();
  
  if (!profile.playerId) {
    throw new Error('playerId est requis');
  }
  
  // Ajouter/mettre à jour les timestamps
  const existingProfile = profiles[profile.playerId];
  const now = new Date().toISOString();
  
  const updatedProfile = {
    ...profile,
    updatedAt: now,
    createdAt: existingProfile?.createdAt || now
  };
  
  profiles[profile.playerId] = updatedProfile;
  await saveProfiles(profiles);
  
  return updatedProfile;
}

/**
 * Supprime un profil
 */
export async function deleteProfile(playerId) {
  const profiles = await loadProfiles();
  
  if (profiles[playerId]) {
    delete profiles[playerId];
    await saveProfiles(profiles);
    return true;
  }
  
  return false;
}



