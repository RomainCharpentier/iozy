/**
 * Repository pour la gestion des catégories (persistance fichier)
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORIES_FILE = path.join(__dirname, '../../data/categories.json');

// Catégories par défaut
const DEFAULT_CATEGORIES = [
  { id: 'chansons', name: 'Chansons', emoji: '🎵' },
  { id: 'series', name: 'Séries TV', emoji: '📺' },
  { id: 'animes', name: 'Animes', emoji: '🎌' },
  { id: 'films', name: 'Films', emoji: '🎬' },
  { id: 'jeux', name: 'Jeux vidéo', emoji: '🎮' },
];

/**
 * Charge les catégories depuis le fichier
 */
export async function loadCategories() {
  try {
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(CATEGORIES_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    const data = await fs.readFile(CATEGORIES_FILE, 'utf-8');
    const categories = JSON.parse(data);
    // S'assurer que les catégories par défaut existent
    const defaultIds = DEFAULT_CATEGORIES.map(c => c.id);
    const existingIds = categories.map(c => c.id);
    const missingDefaults = DEFAULT_CATEGORIES.filter(c => !existingIds.includes(c.id));
    return [...categories, ...missingDefaults];
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas, retourner catégories par défaut
      await saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    // Fichier illisible ou JSON corrompu : lever une erreur plutôt que renvoyer les
    // catégories par défaut, sinon la prochaine écriture effacerait les catégories personnalisées
    console.error('Erreur lors du chargement des catégories:', error);
    throw error;
  }
}

/**
 * Sauvegarde les catégories dans le fichier
 */
export async function saveCategories(categories) {
  try {
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(CATEGORIES_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des catégories:', error);
    throw error;
  }
}

/**
 * Ajoute une nouvelle catégorie
 */
export async function addCategory(category) {
  const categories = await loadCategories();
  
  // Vérifier si la catégorie existe déjà
  if (categories.find(c => c.id === category.id)) {
    throw new Error('Une catégorie avec cet ID existe déjà');
  }
  
  categories.push(category);
  await saveCategories(categories);
  return category;
}

/**
 * Met à jour une catégorie existante
 */
export async function updateCategory(categoryId, updates) {
  const categories = await loadCategories();
  const index = categories.findIndex(c => c.id === categoryId);
  
  if (index === -1) {
    throw new Error('Catégorie non trouvée');
  }
  
  categories[index] = { ...categories[index], ...updates };
  await saveCategories(categories);
  return categories[index];
}

/**
 * Supprime une catégorie
 */
export async function deleteCategory(categoryId) {
  // Empêcher la suppression des catégories par défaut
  const defaultIds = DEFAULT_CATEGORIES.map(c => c.id);
  if (defaultIds.includes(categoryId)) {
    throw new Error('Impossible de supprimer une catégorie par défaut');
  }
  
  const categories = await loadCategories();
  const filtered = categories.filter(c => c.id !== categoryId);
  await saveCategories(filtered);
  return true;
}

















