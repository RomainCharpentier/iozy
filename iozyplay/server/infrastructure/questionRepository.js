/**
 * Repository pour la gestion des questions (persistance fichier)
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUESTIONS_FILE = path.join(__dirname, '../../data/questions.json');

/**
 * Charge les questions depuis le fichier
 */
export async function loadQuestions() {
  try {
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(QUESTIONS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    const data = await fs.readFile(QUESTIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas, retourner structure vide
      return {};
    }
    console.error('Erreur lors du chargement des questions:', error);
    return {};
  }
}

/**
 * Sauvegarde les questions dans le fichier
 */
export async function saveQuestions(questionsData) {
  try {
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(QUESTIONS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(QUESTIONS_FILE, JSON.stringify(questionsData, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des questions:', error);
    throw error;
  }
}

/**
 * Ajoute une question
 */
export async function addQuestion(question) {
  const questionsData = await loadQuestions();
  const category = question.category;
  
  // Vérifier si la question existe déjà (par mediaUrl pour YouTube)
  const existingIndex = questionsData[category].findIndex(
    q => q.mediaUrl === question.mediaUrl || q.id === question.id
  );
  
  if (existingIndex >= 0) {
    // Mettre à jour la question existante
    questionsData[category][existingIndex] = question;
  } else {
    // Ajouter la nouvelle question
    questionsData[category].push(question);
  }
  
  await saveQuestions(questionsData);
  return question;
}

/**
 * Supprime une question
 */
export async function deleteQuestion(questionId, category) {
  const questionsData = await loadQuestions();
  questionsData[category] = questionsData[category].filter(
    q => q.id !== questionId && q.mediaUrl !== questionId
  );
  await saveQuestions(questionsData);
  return true;
}

