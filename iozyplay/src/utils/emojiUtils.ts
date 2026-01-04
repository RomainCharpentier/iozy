/**
 * Utilitaires pour détecter et gérer les emojis
 */

/**
 * Vérifie si une chaîne est un emoji (ou plusieurs emojis)
 */
export function isEmoji(str: string): boolean {
  if (!str || str.trim() === '') return false
  
  // Pattern pour détecter les emojis Unicode
  // Couvre: Emojis standards, symboles, drapeaux, etc.
  const emojiPattern = /^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE0F}]$/u
  
  return emojiPattern.test(str.trim())
}




