/**
 * Casse une règle exprès, vérifie qu'un test tombe, remet le fichier en état.
 *
 * Un test qui passe ne prouve rien tant qu'on n'a pas vu ce qu'il fait quand
 * la règle tombe. Ce script automatise ce contrôle - et surtout, il refuse de
 * conclure quand la mutation elle-même n'a pas été appliquée : c'est arrivé
 * deux fois en écrivant ces tests (un `perl s///` sans `/g` mutant la seule
 * des deux occurrences que le test ne regardait pas), et une mutation qui ne
 * fait rien échouer se lit exactement comme un test inutile.
 *
 * Usage :
 *   node scripts/mutation.mjs <fichier> <ancien> <nouveau>
 *
 * Exemple :
 *   node scripts/mutation.mjs src/routes/Shelf/shelfTiles.ts "missing <= 3" "missing <= 4"
 *
 * Sort en 0 quand la mutation a bien fait échouer au moins un test (le filet
 * tient), en 1 sinon. Le fichier est restauré dans tous les cas, y compris
 * après une interruption.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const [fichier, ancien, nouveau] = process.argv.slice(2)

if (!fichier || ancien === undefined || nouveau === undefined) {
  console.error('Usage : node scripts/mutation.mjs <fichier> <ancien> <nouveau>')
  process.exit(2)
}

const original = readFileSync(fichier, 'utf8')
const occurrences = original.split(ancien).length - 1

if (occurrences === 0) {
  console.error(`Texte introuvable dans ${fichier} : ${JSON.stringify(ancien)}`)
  console.error("Rien n'a été modifié - la mesure n'aurait rien voulu dire.")
  process.exit(2)
}

// Toutes les occurrences, jamais la première seule : muter une copie sur deux
// laisse le test vert pour une raison qui n'a rien à voir avec le test.
writeFileSync(fichier, original.split(ancien).join(nouveau))
console.log(`Mutation appliquée (${occurrences} occurrence${occurrences > 1 ? 's' : ''}) dans ${fichier}`)

const restaurer = () => writeFileSync(fichier, original)
process.on('SIGINT', () => {
  restaurer()
  process.exit(130)
})

let sortie
try {
  // Commande en une chaîne : `shell: true` avec un tableau d'arguments est
  // déprécié par Node (les arguments y sont concaténés sans échappement).
  sortie = spawnSync('npx vitest run', { encoding: 'utf8', shell: true })
} finally {
  restaurer()
  console.log('Fichier restauré.')
}

const resume = (sortie.stdout ?? '').split('\n').find((l) => /Tests\s+\d+ (failed|passed)/.test(l))
console.log(resume?.trim() ?? '(aucun résumé de test lisible)')

if (sortie.status === 0) {
  console.error('\nAUCUN test n’a échoué : cette règle n’est gardée par rien.')
  process.exit(1)
}
console.log('\nLa mutation a bien été rattrapée par un test.')
