import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  loadQuestions,
  saveQuestions,
  addQuestion,
  deleteQuestion,
  getQuestionsFile,
  CorruptedQuestionsFileError,
  InvalidQuestionsDataError
} from './questionRepository.js';

// Isoler les écritures dans un dossier temporaire (ne jamais toucher data/questions.json)
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'blindtest-questions-'));
const originalEnv = process.env.QUESTIONS_FILE;
let testFile;
let counter = 0;

const q = (id, category) => ({
  id,
  category,
  type: 'video',
  mediaUrl: `https://youtu.be/${id}`,
  answer: `Réponse ${id}`
});

async function writeRaw(content) {
  await fs.writeFile(testFile, content, 'utf-8');
}

async function readJson() {
  return JSON.parse(await fs.readFile(testFile, 'utf-8'));
}

describe('questionRepository', () => {
  beforeEach(() => {
    counter++;
    testFile = path.join(tmpDir, `questions-${counter}.json`);
    process.env.QUESTIONS_FILE = testFile;
  });

  after(async () => {
    if (originalEnv === undefined) delete process.env.QUESTIONS_FILE;
    else process.env.QUESTIONS_FILE = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('utilise le fichier défini par QUESTIONS_FILE', () => {
    assert.strictEqual(getQuestionsFile(), testFile);
  });

  test('loadQuestions retourne {} si le fichier est absent', async () => {
    assert.deepStrictEqual(await loadQuestions(), {});
  });

  test('loadQuestions lève une erreur sur un JSON corrompu', async () => {
    await writeRaw('{ "chansons": [ ');
    await assert.rejects(loadQuestions(), CorruptedQuestionsFileError);
  });

  test('loadQuestions lève une erreur sur une structure invalide', async () => {
    await writeRaw('[1, 2, 3]');
    await assert.rejects(loadQuestions(), CorruptedQuestionsFileError);
  });

  test('addQuestion crée une catégorie absente du fichier', async () => {
    await writeRaw(JSON.stringify({ chansons: [q('a', 'chansons')] }));
    await addQuestion(q('b', 'ma-categorie'));
    const data = await readJson();
    assert.strictEqual(data.chansons.length, 1);
    assert.deepStrictEqual(data['ma-categorie'].map(x => x.id), ['b']);
  });

  test('addQuestion fonctionne sans fichier existant', async () => {
    await addQuestion(q('a', 'animes'));
    assert.deepStrictEqual((await readJson()).animes.map(x => x.id), ['a']);
  });

  test('addQuestion gère une catégorie tableau (multi-catégories)', async () => {
    await writeRaw(JSON.stringify({ films: [] }));
    await addQuestion(q('a', ['films', 'perso']));
    const data = await readJson();
    assert.deepStrictEqual(data.films.map(x => x.id), ['a']);
    assert.deepStrictEqual(data.perso.map(x => x.id), ['a']);
  });

  test('addQuestion met à jour une question existante (même mediaUrl)', async () => {
    await writeRaw(JSON.stringify({ films: [q('a', 'films')] }));
    await addQuestion({ ...q('a', 'films'), answer: 'Nouvelle' });
    const data = await readJson();
    assert.strictEqual(data.films.length, 1);
    assert.strictEqual(data.films[0].answer, 'Nouvelle');
  });

  test('addQuestion sans id ne remplace pas une autre question sans id', async () => {
    const withoutId = (name) => ({ category: 'films', type: 'video', mediaUrl: `https://youtu.be/${name}`, answer: name });
    await writeRaw(JSON.stringify({ films: [withoutId('x')] }));
    await addQuestion(withoutId('y'));
    assert.strictEqual((await readJson()).films.length, 2);
  });

  test('addQuestion rejette une catégorie invalide sans écrire', async () => {
    await writeRaw(JSON.stringify({ films: [q('a', 'films')] }));
    await assert.rejects(addQuestion(q('b', [])), InvalidQuestionsDataError);
    await assert.rejects(addQuestion(q('b', undefined)), InvalidQuestionsDataError);
    assert.strictEqual((await readJson()).films.length, 1);
  });

  test('addQuestion refuse d\'écraser un fichier corrompu', async () => {
    const corrupted = '{ "chansons": [ ';
    await writeRaw(corrupted);
    await assert.rejects(addQuestion(q('a', 'chansons')), CorruptedQuestionsFileError);
    assert.strictEqual(await fs.readFile(testFile, 'utf-8'), corrupted);
  });

  test('deleteQuestion sans catégorie supprime de toutes les catégories', async () => {
    await writeRaw(JSON.stringify({
      films: [q('a', ['films', 'perso']), q('b', 'films')],
      perso: [q('a', ['films', 'perso'])]
    }));
    assert.strictEqual(await deleteQuestion('a'), true);
    const data = await readJson();
    assert.deepStrictEqual(data.films.map(x => x.id), ['b']);
    assert.deepStrictEqual(data.perso, []);
  });

  test('deleteQuestion avec catégorie ne touche que cette catégorie', async () => {
    await writeRaw(JSON.stringify({
      films: [q('a', ['films', 'perso'])],
      perso: [q('a', ['films', 'perso'])]
    }));
    await deleteQuestion('https://youtu.be/a', 'films');
    const data = await readJson();
    assert.deepStrictEqual(data.films, []);
    assert.strictEqual(data.perso.length, 1);
  });

  test('deleteQuestion sur une catégorie inexistante ne plante pas', async () => {
    const content = JSON.stringify({ films: [q('a', 'films')] });
    await writeRaw(content);
    assert.strictEqual(await deleteQuestion('a', 'inconnue'), false);
    assert.strictEqual(await fs.readFile(testFile, 'utf-8'), content);
  });

  test('deleteQuestion refuse d\'écraser un fichier corrompu', async () => {
    await writeRaw('not json');
    await assert.rejects(deleteQuestion('a'), CorruptedQuestionsFileError);
    assert.strictEqual(await fs.readFile(testFile, 'utf-8'), 'not json');
  });

  test('saveQuestions conserve toutes les catégories fournies', async () => {
    const data = { chansons: [q('a', 'chansons')], perso: [q('b', 'perso')] };
    await saveQuestions(data);
    assert.deepStrictEqual(await readJson(), data);
  });

  test('saveQuestions rejette des données invalides sans écrire', async () => {
    const content = JSON.stringify({ films: [q('a', 'films')] });
    await writeRaw(content);
    await assert.rejects(saveQuestions([q('a', 'films')]), InvalidQuestionsDataError);
    await assert.rejects(saveQuestions({ films: 'oops' }), InvalidQuestionsDataError);
    await assert.rejects(saveQuestions(null), InvalidQuestionsDataError);
    assert.strictEqual(await fs.readFile(testFile, 'utf-8'), content);
  });

  test('saveQuestions refuse d\'écraser un fichier corrompu', async () => {
    await writeRaw('{ corrompu');
    await assert.rejects(saveQuestions({ films: [] }), CorruptedQuestionsFileError);
    assert.strictEqual(await fs.readFile(testFile, 'utf-8'), '{ corrompu');
  });

  test('écriture atomique : aucun fichier temporaire résiduel', async () => {
    await saveQuestions({ films: [q('a', 'films')] });
    const leftovers = (await fs.readdir(tmpDir)).filter(f => f.endsWith('.tmp'));
    assert.deepStrictEqual(leftovers, []);
  });

  test('les ajouts concurrents sont tous conservés', async () => {
    await Promise.all(['a', 'b', 'c', 'd', 'e'].map(id => addQuestion(q(id, 'films'))));
    assert.deepStrictEqual((await readJson()).films.map(x => x.id).sort(), ['a', 'b', 'c', 'd', 'e']);
  });

  test('startTime est conservé par addQuestion, saveQuestions et loadQuestions', async () => {
    await addQuestion({ ...q('a', 'films'), startTime: 75 });
    assert.strictEqual((await readJson()).films[0].startTime, 75);

    await saveQuestions({ films: [{ ...q('b', 'films'), startTime: 0 }, q('c', 'films')] });
    const loaded = await loadQuestions();
    assert.strictEqual(loaded.films[0].startTime, 0);
    assert.strictEqual('startTime' in loaded.films[1], false);
  });

  test('startTime invalide : refusé à l\'écriture, sans modifier le fichier', async () => {
    const content = JSON.stringify({ films: [q('a', 'films')] });
    await writeRaw(content);
    for (const startTime of [-1, 1.5, '30', null, 86401]) {
      await assert.rejects(addQuestion({ ...q('b', 'films'), startTime }), InvalidQuestionsDataError);
      await assert.rejects(saveQuestions({ films: [{ ...q('b', 'films'), startTime }] }), InvalidQuestionsDataError);
    }
    assert.strictEqual(await fs.readFile(testFile, 'utf-8'), content);
  });

  test('un startTime invalide déjà présent ne rend pas le fichier corrompu', async () => {
    await writeRaw(JSON.stringify({ films: [{ ...q('a', 'films'), startTime: 'abc' }] }));
    const loaded = await loadQuestions();
    assert.strictEqual(loaded.films[0].startTime, 'abc');
  });
});
