/**
 * Utilitaires de domaine pour normaliser et comparer les réponses
 * Logique métier pure, aucune dépendance externe
 */

/**
 * Normalise une chaîne de caractères pour la comparaison :
 * - Supprime les accents
 * - Convertit en minuscules
 * - Supprime les espaces en début/fin
 * - Remplace les espaces multiples par un seul espace
 * - Supprime les caractères spéciaux non nécessaires
 */
export function normalizeAnswer(answer) {
    if (!answer) return '';
    
    return answer
        .trim()
        .replace(/\s+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[!?.,;:()[\]{}"]/g, '')
        .replace(/[''""]/g, "'")
        .replace(/[–—]/g, '-')
        .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + 1
                );
            }
        }
    }

    return matrix[len1][len2];
}

/**
 * Compare deux réponses en les normalisant
 * Accepte les réponses si elles sont identiques ou très similaires
 */
export function compareAnswers(answer1, answer2) {
    const normalized1 = normalizeAnswer(answer1);
    const normalized2 = normalizeAnswer(answer2);
    
    if (normalized1 === normalized2) {
        return true;
    }
    
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    if (maxLength < 3) {
        return false;
    }
    
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxDistance = maxLength <= 5 ? 1 : Math.max(1, Math.floor(maxLength * 0.1));
    
    return distance <= maxDistance;
}
