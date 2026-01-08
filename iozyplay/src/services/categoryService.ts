/**
 * Service de gestion des catégories
 */
import type { CategoryInfo } from '../types'
import { categoriesApi, ApiError } from '../api'

/**
 * Liste d'icônes disponibles pour les catégories
 */
export const AVAILABLE_ICONS = [
  '🎵', '🎶', '🎤', '🎧', '🎸', '🎹', '🥁', '🎺', '🎷', '🎻',
  '📺', '📽️', '🎬', '🎞️', '🎭', '🎪', '🎨', '🖼️', '📷', '📸',
  '🎮', '🕹️', '🎯', '🎲', '🃏', '🀄', '🎴', '🎰', '🪅', '🪆',
  '🎌', '🏯', '🗾', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🎀',
  '📚', '📖', '📕', '📗', '📘', '📙', '📓', '📔', '📒', '📃',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸',
  '🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥞', '🧇', '🍳',
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻',
  '⭐', '🌟', '💫', '✨', '🔥', '💥', '⚡', '☄️', '💢', '❄️',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '🎁', '🎉', '🎊', '🎈', '🎀', '🏆', '🥇', '🥈', '🥉', '🏅',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸',
  '🎪', '🎭', '🎨', '🖼️', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
  '🎮', '🕹️', '🎯', '🎲', '🃏', '🀄', '🎴', '🎰', '🧩', '♟️',
  '📱', '💻', '🖥️', '⌨️', '🖱️', '🖨️', '📞', '☎️', '📟', '📠',
  '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤',
  '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻',
  '🎓', '👓', '🕶️', '🥽', '🥼', '🦺', '👑', '🎩', '🎓', '🧢',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸',
];

/**
 * Charge les catégories depuis le serveur
 */
export async function loadCategories(): Promise<CategoryInfo[]> {
  try {
    return await categoriesApi.getAll()
  } catch (error) {
    console.error('Erreur lors du chargement des catégories:', error)
    return []
  }
}

/**
 * Crée une nouvelle catégorie
 */
export async function createCategory(category: CategoryInfo): Promise<CategoryInfo> {
  try {
    return await categoriesApi.create(category)
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to create category')
  }
}

/**
 * Met à jour une catégorie
 */
export async function updateCategory(categoryId: string, updates: Partial<CategoryInfo>): Promise<CategoryInfo> {
  try {
    return await categoriesApi.update(categoryId, updates)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to update category')
  }
}

/**
 * Supprime une catégorie
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    await categoriesApi.delete(categoryId)
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new Error(error instanceof Error ? error.message : 'Failed to delete category')
  }
}











