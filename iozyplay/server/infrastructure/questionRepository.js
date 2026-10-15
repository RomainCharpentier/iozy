/**
 * Repository pour la gestion des questions (persistance fichier)
 *
 * Garanties contre la perte de données :
 * - un fichier JSON illisible/corrompu lève une erreur au lieu d'être traité comme vide,
 *   ce qui empêche toute écriture ultérieure de l'écraser ;
 * - l'écriture est atomique (fichier temporaire puis rename) ;
 * - les opérations lecture-modification-écriture sont sérialisées.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_QUESTIONS_FILE = path.join(__dirname, '../../data/questions.json');

/**
 * Chemin du fichier de questions (surchargeable via QUESTIONS_FILE, utile pour les tests)
 */
export function getQuestionsFile() {
  return process.env.QUESTIONS_FILE || DEFAULT_QUESTIONS_FILE;
}

/**
 * Erreur levée quand le fichier de questions existe mais ne peut pas être interprété
 */
export class CorruptedQuestionsFileError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'CorruptedQuestionsFileError';
  }
}

/**
 * Erreur levée quand les données fournies sont invalides
 */
export class InvalidQuestionsDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidQuestionsDataError';
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Vérifie que la structure correspond à { [categorie]: Question[] }
 */
function assertValidQuestionsData(questionsData) {
  if (!isPlainObject(questionsData)) {
    throw new InvalidQuestionsDataError('Les questions doivent être un objet { categorie: Question[] }');
  }
  for (const [category, questions] of Object.entries(questionsData)) {
    if (!Array.isArray(questions) || !questions.every(isPlainObject)) {
      throw new InvalidQuestionsDataError(`La catégorie "${category}" doit contenir un tableau de questions`);
    }
  }
}

/**
 * Normalise la catégorie d'une question en tableau de chaînes non vides
 */
function toCategoryList(category) {
  const list = Array.isArray(category) ? category : [category];
  if (list.length === 0 || !list.every(cat => typeof cat === 'string' && cat.trim() !== '')) {
    throw new InvalidQuestionsDataError('category doit être une chaîne ou un tableau de chaînes non vides');
  }
  return [...new Set(list)];
}

// File d'attente pour sérialiser les opérations lecture-modification-écriture
let writeQueue = Promise.resolve();

function withWriteLock(task) {
  const run = writeQueue.then(task, task);
  // Ne pas bloquer la file si une opération échoue
  writeQueue = run.catch(() => {});
  return run;
}

/**
 * Charge les questions depuis le fichier.
 * Retourne {} uniquement si le fichier n'existe pas ; lève une erreur s'il est corrompu.
 */
export async function loadQuestions() {
  const file = getQuestionsFile();
  let raw;
  try {
    raw = await fs.readFile(file, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas, retourner structure vide
      return {};
    }
    throw error;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new CorruptedQuestionsFileError(
      `Fichier de questions corrompu : JSON invalide. Aucune écriture ne sera effectuée.`,
      { cause: error }
    );
  }

  try {
    assertValidQuestionsData(data);
  } catch (error) {
    throw new CorruptedQuestionsFileError(
      `Fichier de questions corrompu : ${error.message}. Aucune écriture ne sera effectuée.`,
      { cause: error }
    );
  }
  return data;
}

/**
 * Écrit le fichier de manière atomique (tmp + rename)
 */
async function writeQuestionsFile(questionsData) {
  const file = getQuestionsFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmpFile, JSON.stringify(questionsData, null, 2), 'utf-8');
    await fs.rename(tmpFile, file);
  } catch (error) {
    await fs.rm(tmpFile, { force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Remplace toutes les questions.
 * Refuse d'écrire si les données sont invalides ou si le fichier actuel est corrompu.
 */
export async function saveQuestions(questionsData) {
  assertValidQuestionsData(questionsData);
  return withWriteLock(async () => {
    // Vérifie que le fichier existant est lisible avant de l'écraser
    await loadQuestions();
    await writeQuestionsFile(questionsData);
    return true;
  });
}

/**
 * Ajoute (ou met à jour) une question dans chacune de ses catégories.
 * Crée les catégories absentes du fichier.
 */
export async function addQuestion(question) {
  const categories = toCategoryList(question.category);

  return withWriteLock(async () => {
    const questionsData = await loadQuestions();

    for (const category of categories) {
      if (!Array.isArray(questionsData[category])) {
        questionsData[category] = [];
      }
      const list = questionsData[category];
      // Vérifier si la question existe déjà (par mediaUrl, ou par id s'il est défini)
      const existingIndex = list.findIndex(
        q => q.mediaUrl === question.mediaUrl || (question.id != null && q.id === question.id)
      );

      if (existingIndex >= 0) {
        list[existingIndex] = question;
      } else {
        list.push(question);
      }
    }

    await writeQuestionsFile(questionsData);
    return question;
  });
}

/**
 * Supprime une question.
 * Si category est fourni, supprime seulement de cette catégorie,
 * sinon supprime la question de toutes les catégories.
 * Retourne true si au moins une occurrence a été supprimée.
 */
export async function deleteQuestion(questionId, category) {
  return withWriteLock(async () => {
    const questionsData = await loadQuestions();
    const targetCategories = category
      ? (Array.isArray(category) ? category : [category])
      : Object.keys(questionsData);
    const matches = q => q.id === questionId || q.mediaUrl === questionId;

    let removed = false;
    for (const cat of targetCategories) {
      const list = questionsData[cat];
      if (!Array.isArray(list)) continue;
      const filtered = list.filter(q => !matches(q));
      if (filtered.length !== list.length) {
        questionsData[cat] = filtered;
        removed = true;
      }
    }

    if (removed) {
      await writeQuestionsFile(questionsData);
    }
    return removed;
  });
}
