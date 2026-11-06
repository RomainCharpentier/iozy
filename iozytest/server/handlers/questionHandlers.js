/**
 * Gestionnaires d'API REST pour les questions
 */

import {
  loadQuestions,
  addQuestion,
  deleteQuestion,
  saveQuestions,
  CorruptedQuestionsFileError,
  InvalidQuestionsDataError
} from '../infrastructure/questionRepository.js';

/**
 * Réponse d'erreur commune : 400 pour des données invalides,
 * 500 explicite si le fichier est corrompu (aucune écriture effectuée)
 */
function sendRepositoryError(res, error, fallbackMessage) {
  if (error instanceof InvalidQuestionsDataError) {
    return res.status(400).json({ error: 'Erreurs de validation', details: [error.message] });
  }
  if (error instanceof CorruptedQuestionsFileError) {
    return res.status(500).json({
      error: 'Fichier de questions corrompu : aucune modification enregistrée',
      details: error.message
    });
  }
  return res.status(500).json({ error: fallbackMessage });
}

/**
 * GET /api/questions - Récupère toutes les questions
 */
export async function getAllQuestions(req, res) {
  try {
    const questionsData = await loadQuestions();
    res.json(questionsData);
  } catch (error) {
    console.error('Erreur lors de la récupération des questions:', error);
    sendRepositoryError(res, error, 'Erreur serveur lors de la récupération des questions');
  }
}

/**
 * POST /api/questions - Ajoute une nouvelle question
 */
export async function createQuestion(req, res) {
  try {
    const question = req.body;
    
    // Validation complète
    const errors = [];
    
    if (!question.mediaUrl || typeof question.mediaUrl !== 'string' || question.mediaUrl.trim() === '') {
      errors.push('mediaUrl est requis et doit être une chaîne non vide');
    }
    
    if (!question.answer || typeof question.answer !== 'string' || question.answer.trim() === '') {
      errors.push('answer est requis et doit être une chaîne non vide');
    }
    
    if (!question.category) {
      errors.push('category est requis');
    } else {
      // Vérifier que category est soit une string soit un array de strings
      const isValidCategory = typeof question.category === 'string' || 
        (Array.isArray(question.category) && question.category.length > 0 && 
         question.category.every(cat => typeof cat === 'string' && cat.trim() !== ''));
      if (!isValidCategory) {
        errors.push('category doit être une chaîne ou un tableau de chaînes non vides');
      }
    }
    
    // Validation de l'URL YouTube
    if (question.mediaUrl) {
      const isYouTube = question.mediaUrl.includes('youtube.com') || question.mediaUrl.includes('youtu.be');
      if (!isYouTube) {
        errors.push('Seules les URLs YouTube sont supportées pour l\'instant');
      } else {
        // Validation basique du format URL
        try {
          const urlWithProtocol = question.mediaUrl.startsWith('http://') || question.mediaUrl.startsWith('https://') 
            ? question.mediaUrl 
            : `https://${question.mediaUrl}`;
          new URL(urlWithProtocol);
        } catch {
          errors.push('Format d\'URL invalide');
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Erreurs de validation',
        details: errors
      });
    }
    
    const savedQuestion = await addQuestion(question);
    res.status(201).json(savedQuestion);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la question:', error);
    sendRepositoryError(res, error, 'Erreur serveur lors de l\'ajout de la question');
  }
}

/**
 * DELETE /api/questions/:id - Supprime une question
 */
export async function removeQuestion(req, res) {
  try {
    const { id } = req.params;
    const { category } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'ID de question requis' });
    }
    
    // category est optionnel maintenant (suppression complète si non fourni)
    await deleteQuestion(id, category);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de la question:', error);
    if (error instanceof CorruptedQuestionsFileError) {
      return sendRepositoryError(res, error);
    }
    const statusCode = error.message?.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ 
      error: 'Erreur serveur lors de la suppression de la question',
      details: error.message 
    });
  }
}

/**
 * PUT /api/questions - Met à jour toutes les questions (pour compatibilité)
 */
export async function updateAllQuestions(req, res) {
  try {
    const questionsData = req.body;
    await saveQuestions(questionsData);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des questions:', error);
    sendRepositoryError(res, error, 'Erreur serveur lors de la mise à jour des questions');
  }
}




