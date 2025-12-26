/**
 * Service de gestion des catégories
 */
import type { CategoryInfo } from './types'

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001'

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
    const response = await fetch(`${API_BASE_URL}/api/categories`)
    if (!response.ok) {
      throw new Error('Failed to load categories')
    }
    return await response.json()
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
    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create category')
    }
    return await response.json()
  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error)
    throw error
  }
}

/**
 * Met à jour une catégorie
 */
export async function updateCategory(categoryId: string, updates: Partial<CategoryInfo>): Promise<CategoryInfo> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update category')
    }
    return await response.json()
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error)
    throw error
  }
}

/**
 * Supprime une catégorie
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete category')
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error)
    throw error
  }
}





