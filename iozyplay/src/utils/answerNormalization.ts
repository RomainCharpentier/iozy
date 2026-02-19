/**
 * Utilitaires pour normaliser les réponses et gérer la validation
 */

/**
 * Normalise une chaîne de caractères pour la comparaison :
 * - Supprime les accents
 * - Convertit en minuscules
 * - Supprime les espaces en début/fin
 * - Remplace les espaces multiples par un seul espace
 * - Supprime les caractères spéciaux non nécessaires
 */
export function normalizeAnswer(answer: string): string {
  if (!answer) return ''

  return (
    answer
      .trim()
      // Normaliser les espaces multiples (y compris les espaces insécables)
      .replace(/\s+/g, ' ')
      // Supprimer les accents
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Convertir en minuscules
      .toLowerCase()
      // Supprimer seulement certains caractères de ponctuation (garder tirets, apostrophes)
      // Supprimer : ! ? . , ; : ( ) [ ] { } " ' mais garder - et '
      .replace(/[!?.,;:()[\]{}"]/g, '')
      // Normaliser les apostrophes et guillemets
      .replace(/[''""]/g, "'")
      // Normaliser les tirets (différents types de tirets)
      .replace(/[–—]/g, '-')
      .trim()
  )
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * (nombre minimum de modifications pour transformer une chaîne en une autre)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  // Initialiser la matrice
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Remplir la matrice
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // Suppression
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j - 1] + 1 // Substitution
        )
      }
    }
  }

  return matrix[len1][len2]
}

/**
 * Compare deux réponses en les normalisant
 * Accepte les réponses si elles sont identiques ou très similaires (tolérance aux fautes de frappe)
 */
export function compareAnswers(answer1: string, answer2: string): boolean {
  const normalized1 = normalizeAnswer(answer1)
  const normalized2 = normalizeAnswer(answer2)

  // Correspondance exacte
  if (normalized1 === normalized2) {
    return true
  }

  // Vérifier la similarité pour les fautes de frappe mineures
  // On accepte si la distance de Levenshtein est faible par rapport à la longueur
  const maxLength = Math.max(normalized1.length, normalized2.length)

  // Si les chaînes sont trop courtes (< 3 caractères), on exige une correspondance exacte
  if (maxLength < 3) {
    return false
  }

  // Calculer la distance de Levenshtein
  const distance = levenshteinDistance(normalized1, normalized2)

  // Accepter si la distance est <= 1 caractère pour les mots courts (3-5 caractères)
  // ou <= 10% de la longueur pour les mots plus longs
  const maxDistance = maxLength <= 5 ? 1 : Math.max(1, Math.floor(maxLength * 0.1))

  return distance <= maxDistance
}
