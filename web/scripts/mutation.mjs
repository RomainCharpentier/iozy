/**
 * Breaks a rule on purpose, checks that a test fails, puts the file back.
 *
 * A passing test proves nothing until we have seen what it does when the rule
 * breaks. This script automates that check - and above all, it refuses to
 * conclude when the mutation itself was not applied: this happened twice
 * while writing these tests (a `perl s///` without `/g` mutating only the one
 * of two occurrences that the test did not look at), and a mutation that
 * makes nothing fail reads exactly like a useless test.
 *
 * Usage:
 *   node scripts/mutation.mjs <file> <old> <new>
 *
 * Example:
 *   node scripts/mutation.mjs src/routes/Shelf/shelfTiles.ts "missing <= 3" "missing <= 4"
 *
 * Exits with 0 when the mutation did make at least one test fail (the net
 * holds), with 1 otherwise. The file is restored in every case, including
 * after an interruption.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const [fichier, ancien, nouveau] = process.argv.slice(2)

if (!fichier || ancien === undefined || nouveau === undefined) {
  console.error('Usage: node scripts/mutation.mjs <file> <old> <new>')
  process.exit(2)
}

const original = readFileSync(fichier, 'utf8')
const occurrences = original.split(ancien).length - 1

if (occurrences === 0) {
  console.error(`Text not found in ${fichier}: ${JSON.stringify(ancien)}`)
  console.error('Nothing was modified - the measurement would have meant nothing.')
  process.exit(2)
}

// All the occurrences, never the first one only: mutating one copy out of two
// leaves the test green for a reason that has nothing to do with the test.
writeFileSync(fichier, original.split(ancien).join(nouveau))
console.log(`Mutation applied (${occurrences} occurrence${occurrences > 1 ? 's' : ''}) in ${fichier}`)

const restaurer = () => writeFileSync(fichier, original)
process.on('SIGINT', () => {
  restaurer()
  process.exit(130)
})

let sortie
try {
  // Command as a single string: `shell: true` with an argument array is
  // deprecated by Node (the arguments are concatenated without escaping).
  sortie = spawnSync('npx vitest run', { encoding: 'utf8', shell: true })
} finally {
  restaurer()
  console.log('File restored.')
}

const resume = (sortie.stdout ?? '').split('\n').find((l) => /Tests\s+\d+ (failed|passed)/.test(l))
console.log(resume?.trim() ?? '(no readable test summary)')

if (sortie.status === 0) {
  console.error('\nNO test failed: this rule is guarded by nothing.')
  process.exit(1)
}
console.log('\nThe mutation was caught by a test.')
