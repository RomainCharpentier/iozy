import { test, describe } from 'node:test'
import assert from 'node:assert'
import { shuffle, dedupeQuestions, drawQuestions } from './questionDraw.js'

const q = (id, extra = {}) => ({ id, mediaUrl: `https://youtu.be/${id}`, answer: `Réponse ${id}`, ...extra })
const ids = (questions) => questions.map(x => x.id)
const pool14 = () => Array.from({ length: 14 }, (_, i) => q(`q${i}`, { category: i < 7 ? 'animes' : 'jeux' }))

describe('shuffle', () => {
  test('ne mute pas l’entrée et conserve les éléments', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    const result = shuffle(input)
    assert.deepStrictEqual(input, copy)
    assert.notStrictEqual(result, input)
    assert.deepStrictEqual([...result].sort(), copy)
  })

  test('distribution uniforme des positions (Fisher-Yates)', () => {
    const n = 4
    const runs = 40000
    const counts = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let r = 0; r < runs; r++) {
      shuffle([0, 1, 2, 3]).forEach((value, position) => { counts[value][position]++ })
    }
    const expected = runs / n
    for (const row of counts) {
      for (const c of row) {
        // Tolérance large (±7 %) : le test vérifie l’absence de biais grossier
        assert.ok(Math.abs(c - expected) < expected * 0.07, `compte ${c} trop éloigné de ${expected}`)
      }
    }
  })
})

describe('dedupeQuestions', () => {
  test('retire les doublons par id ou par mediaUrl, garde la première occurrence', () => {
    const a = q('a', { category: 'animes' })
    const aBis = q('a', { category: 'jeux' })
    const sameUrl = { id: 'autre', mediaUrl: a.mediaUrl, answer: 'x' }
    const b = q('b')
    const result = dedupeQuestions([a, aBis, sameUrl, b, null, 42])
    assert.deepStrictEqual(result, [a, b])
  })

  test('ne mute pas l’entrée', () => {
    const input = [q('a'), q('a'), q('b')]
    const copy = structuredClone(input)
    dedupeQuestions(input)
    assert.deepStrictEqual(input, copy)
  })
})

describe('drawQuestions', () => {
  test('respecte le nombre demandé, sans doublon, sans muter le pool', () => {
    const pool = pool14()
    const copy = structuredClone(pool)
    for (let count = 1; count <= 14; count++) {
      const result = drawQuestions(pool, count)
      assert.strictEqual(result.length, count)
      assert.strictEqual(new Set(ids(result)).size, count)
      for (const x of result) assert.ok(pool.includes(x))
    }
    assert.deepStrictEqual(pool, copy)
  })

  test('nombre borné : trop grand → tout le pool, ≤ 0 → 1, absent → tout le pool', () => {
    const pool = pool14()
    assert.strictEqual(drawQuestions(pool, 99).length, 14)
    assert.strictEqual(drawQuestions(pool, 0).length, 1)
    assert.strictEqual(drawQuestions(pool, undefined).length, 14)
    assert.deepStrictEqual(drawQuestions([], 3), [])
  })

  test('déduplique le pool : une question multi-catégories ne sort qu’une fois', () => {
    const multi = q('multi')
    const pool = [multi, { ...multi, category: 'jeux' }, q('b')]
    for (let i = 0; i < 50; i++) {
      const result = drawQuestions(pool, 3)
      assert.strictEqual(result.length, 2)
      assert.deepStrictEqual(ids(result).sort(), ['b', 'multi'])
    }
  })

  test('tirage aléatoire : chaque question peut sortir, et en première position', () => {
    const pool = pool14()
    const seen = new Set()
    const firsts = new Set()
    for (let i = 0; i < 2000; i++) {
      const result = drawQuestions(pool, 3)
      result.forEach(x => seen.add(x.id))
      firsts.add(result[0].id)
    }
    assert.strictEqual(seen.size, 14)
    assert.strictEqual(firsts.size, 14)
  })

  test('les catégories sont entrelacées (pas groupées par catégorie)', () => {
    const pool = pool14()
    let mixed = 0
    for (let i = 0; i < 200; i++) {
      const cats = drawQuestions(pool, 14).map(x => x.category)
      const grouped = cats.slice(0, 7).every(c => c === cats[0])
      if (!grouped) mixed++
    }
    assert.ok(mixed > 190)
  })

  test('nouveau tirage : évite les questions de la partie précédente si le pool le permet', () => {
    const pool = pool14()
    for (let i = 0; i < 200; i++) {
      const first = drawQuestions(pool, 3)
      const second = drawQuestions(pool, 3, { previous: first })
      assert.strictEqual(second.length, 3)
      assert.ok(second.every(x => !ids(first).includes(x.id)), 'question de la partie précédente reprise')
    }
  })

  test('pool à peine plus grand : prend toutes les nouvelles puis complète avec les anciennes', () => {
    const pool = [q('a'), q('b'), q('c'), q('d')]
    const previous = [pool[0], pool[1], pool[2]]
    for (let i = 0; i < 100; i++) {
      const result = drawQuestions(pool, 3, { previous })
      assert.strictEqual(result.length, 3)
      assert.ok(ids(result).includes('d'))
      assert.strictEqual(new Set(ids(result)).size, 3)
    }
  })

  test('pool égal au nombre demandé : toujours un nouvel ordre', () => {
    const pool = [q('a'), q('b'), q('c')]
    for (let i = 0; i < 200; i++) {
      const previous = drawQuestions(pool, 3)
      const next = drawQuestions(pool, 3, { previous })
      assert.deepStrictEqual(ids(next).sort(), ['a', 'b', 'c'])
      assert.notDeepStrictEqual(ids(next), ids(previous))
    }
  })

  test('aléa dégénéré : l’ordre change quand même (filet de sécurité)', () => {
    const pool = [q('a'), q('b')]
    const random = () => 0.999999
    const previous = drawQuestions(pool, 2, { random })
    const next = drawQuestions(pool, 2, { previous, random })
    assert.notDeepStrictEqual(ids(next), ids(previous))
  })
})
