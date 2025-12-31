/**
 * Gestionnaires d'API REST pour les catégories
 */

import { loadCategories, addCategory, updateCategory, deleteCategory } from '../infrastructure/categoryRepository.js';

/**
 * GET /api/categories - Récupère toutes les catégories
 */
export async function getAllCategories(req, res) {
  try {
    const categories = await loadCategories();
    res.json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des catégories' });
  }
}

/**
 * POST /api/categories - Crée une nouvelle catégorie
 */
export async function createCategory(req, res) {
  try {
    const { id, name, emoji } = req.body;
    
    // Validation
    if (!id || !name || !emoji) {
      return res.status(400).json({ error: 'Champs manquants: id, name, emoji requis' });
    }
    
    // Valider le format de l'ID (alphanumérique et tirets)
    if (!/^[a-z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'L\'ID doit contenir uniquement des lettres minuscules, chiffres et tirets' });
    }
    
    const category = await addCategory({ id, name, emoji });
    res.status(201).json(category);
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur lors de la création de la catégorie' });
  }
}

/**
 * PUT /api/categories/:id - Met à jour une catégorie
 */
export async function updateCategoryHandler(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const category = await updateCategory(id, updates);
    res.json(category);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur lors de la mise à jour de la catégorie' });
  }
}

/**
 * DELETE /api/categories/:id - Supprime une catégorie
 */
export async function removeCategory(req, res) {
  try {
    const { id } = req.params;
    await deleteCategory(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur lors de la suppression de la catégorie' });
  }
}











