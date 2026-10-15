import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  START_TIME_MAX,
  isValidStartTime,
  sanitizeQuestionStartTime,
  sanitizeQuestionsStartTime
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
