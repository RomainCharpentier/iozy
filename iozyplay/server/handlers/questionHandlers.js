/**
 * Gestionnaires d'API REST pour les questions
 */

import { loadQuestions, addQuestion, deleteQuestion, saveQuestions } from '../infrastructure/questionRepository.js';

/**
 * GET /api/questions - Récupère toutes les questions
 */
export async function getAllQuestions(req, res) {
  try {
    const questionsData = await loadQuestions();
    res.json(questionsData);
  } catch (error) {
    console.error('Erreur lors de la récupération des questions:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des questions' });
  }
}

/**
 * POST /api/questions - Ajoute une nouvelle question
 */
export async function createQuestion(req, res) {
  try {
    const question = req.body;
    
    // Validation basique
    if (!question.mediaUrl || !question.answer || !question.category) {
      return res.status(400).json({ error: 'Champs manquants: mediaUrl, answer, category requis' });
    }
    
    // Pour YouTube uniquement pour l'instant
    if (!question.mediaUrl.includes('youtube.com') && !question.mediaUrl.includes('youtu.be')) {
      return res.status(400).json({ error: 'Seules les URLs YouTube sont supportées pour l\'instant' });
    }
    
    const savedQuestion = await addQuestion(question);
    res.status(201).json(savedQuestion);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la question:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de la question' });
  }
}

/**
 * DELETE /api/questions/:id - Supprime une question
 */
export async function removeQuestion(req, res) {
  try {
    const { id } = req.params;
    const { category } = req.query;
    
    if (!category) {
      return res.status(400).json({ error: 'Paramètre category requis' });
    }
    
    await deleteQuestion(id, category);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de la question:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression de la question' });
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
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour des questions' });
  }
}




