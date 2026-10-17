import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  START_TIME_MAX,
  isValidStartTime,
  sanitizeQuestionStartTime,
  sanitizeQuestionsStartTime,
  withStartFractions,
  parseYouTubeLengthSeconds,
  isValidDuration
} from './questionMedia.js';

describe('questionMedia - startTime', () => {
  test('isValidStartTime accepte les entiers de 0 à START_TIME_MAX', () => {
    assert.strictEqual(isValidStartTime(0), true);
    assert.strictEqual(isValidStartTime(90), true);
    assert.strictEqual(isValidStartTime(START_TIME_MAX), true);
  });

  test('isValidStartTime refuse les valeurs non entières, négatives ou hors bornes', () => {
    for (const value of [-1, 1.5, START_TIME_MAX + 1, '10', null, undefined, NaN, Infinity]) {
      assert.strictEqual(isValidStartTime(value), false, `valeur ${String(value)}`);
    }
  });

  test('sanitizeQuestionStartTime conserve un startTime valide (même objet)', () => {
    const question = { mediaUrl: 'https://youtu.be/a', answer: 'A', startTime: 30 };
    assert.strictEqual(sanitizeQuestionStartTime(question), question);
  });

  test('sanitizeQuestionStartTime laisse une question sans startTime intacte', () => {
    const question = { mediaUrl: 'https://youtu.be/a', answer: 'A' };
    assert.strictEqual(sanitizeQuestionStartTime(question), question);
  });

  test('sanitizeQuestionStartTime retire un startTime invalide sans muter l\'original', () => {
    const question = { mediaUrl: 'https://youtu.be/a', answer: 'A', startTime: 'abc' };
    const result = sanitizeQuestionStartTime(question);
    assert.deepStrictEqual(result, { mediaUrl: 'https://youtu.be/a', answer: 'A' });
    assert.strictEqual(question.startTime, 'abc');
  });

  test('sanitizeQuestionsStartTime traite une liste', () => {
    const result = sanitizeQuestionsStartTime([{ startTime: 5 }, { startTime: -2 }]);
    assert.deepStrictEqual(result, [{ startTime: 5 }, {}]);
  });
});

describe('questionMedia - départ aléatoire', () => {
  test('withStartFractions : une fraction dans [0, 1) par question, sans muter les entrées', () => {
    const questions = [{ id: 'a' }, { id: 'b', startFraction: 0.5 }];
    const values = [0.25, 0.999999];
    const result = withStartFractions(questions, () => values.shift());
    assert.deepStrictEqual(result.map((q) => q.startFraction), [0.25, 0.9999]);
    assert.strictEqual(questions[0].startFraction, undefined);
    // Une fraction envoyée par le client hôte est remplacée par celle du serveur
    assert.notStrictEqual(result[1].startFraction, 0.5);
  });
});

describe('questionMedia - durée', () => {
  test('parseYouTubeLengthSeconds lit lengthSeconds dans la page', () => {
    assert.strictEqual(parseYouTubeLengthSeconds('..."lengthSeconds":"213",...'), 213);
    assert.strictEqual(parseYouTubeLengthSeconds('<html>pas de durée</html>'), null);
    assert.strictEqual(parseYouTubeLengthSeconds(undefined), null);
  });

  test('durée invalide retirée, durée valide conservée', () => {
    assert.ok(isValidDuration(213));
    assert.ok(!isValidDuration(0));
    assert.ok(!isValidDuration('213'));
    const [valid, invalid] = sanitizeQuestionsStartTime([
      { id: 'a', duration: 213 },
      { id: 'b', duration: -5 }
    ]);
    assert.strictEqual(valid.duration, 213);
    assert.ok(!('duration' in invalid));
  });
});
