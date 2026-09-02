/**
 * Quel numéro porte le commit courant — Majeure.Mineure.Patch.
 *
 * <h2>Le numéro se DÉDUIT des commits</h2>
 * Ce dépôt écrit ses messages en Conventional Commits depuis le début
 * (`feat(version): …`, `fix(deploiement): …`) : la nature de chaque changement
 * est donc déjà écrite, et c'est exactement ce qu'un numéro sémantique doit
 * dire. Le déduire plutôt que le poser à la main évite le seul défaut d'une
 * version manuelle : celle qu'on oublie d'incrémenter un soir de correction
 * rapide, et qui fait passer deux livraisons différentes pour la même.
 *
 * <h2>La règle, en trois lignes</h2>
 * <ul>
 *   <li>un commit qui CASSE (`feat!:`, ou `BREAKING CHANGE:` en pied de
 *       message) → Majeure + 1, le reste à zéro ;</li>
 *   <li>`feat:` → Mineure + 1, Patch à zéro ;</li>
 *   <li>tout le reste — `fix`, `perf`, `refactor`, `docs`, `test`, `chore`… →
 *       Patch + 1.</li>
 * </ul>
 *
 * <p>Le dernier point est un choix, et il se paie : `docs:` n'est pas un
 * correctif. Mais un commit déployé qui ne bougerait AUCUN chiffre donnerait
 * deux livraisons différentes portant le même numéro — précisément ce que ce
 * numéro existe pour éviter. Toute chose qui part mérite au moins un patch.
 *
 * <h2>Le point de départ est une étiquette, et une décision humaine y suffit</h2>
 * On repart de la dernière étiquette `vX.Y.Z` atteignable, et on n'applique que
 * les commits qui la suivent. En temps normal c'est le déploiement précédent
 * qui l'a posée, donc le calcul est court. Mais poser `git tag -a v2.0.0` à la
 * main suffit à décider d'un cap : le calcul repart de là, sans qu'une seule
 * ligne de ce fichier ait à le savoir.
 *
 * <h2>Pas d'étiquette, pas de numéro</h2>
 * Sans étiquette de départ, ce script ÉCHOUE au lieu de repartir de 1.0.0 :
 * c'est le signe d'un clone superficiel ou d'étiquettes non récupérées, et un
 * numéro qui recule se lit exactement comme un numéro qui avance.
 */
import { execFileSync } from 'node:child_process'

const DEBUT_CONVENTIONNEL = /^([a-z]+)(\([^)]*\))?(!)?:/

/** `v1.4.2` → `[1, 4, 2]`. Rend `null` sur tout le reste. */
export function lireEtiquette(etiquette) {
  const trouve = /^v(\d+)\.(\d+)\.(\d+)$/.exec(etiquette.trim())
  return trouve ? [Number(trouve[1]), Number(trouve[2]), Number(trouve[3])] : null
}

/** Un commit qui casse l'existant, dans les deux écritures de la convention. */
export function casseLExistant(message) {
  const [sujet, ...corps] = message.split('\n')
  if (DEBUT_CONVENTIONNEL.exec(sujet)?.[3] === '!') return true
  return corps.some((ligne) => /^BREAKING[ -]CHANGE:/.test(ligne.trim()))
}

/** `feat:` et lui seul — `feat!` est déjà parti dans la majeure. */
export function apporteUneFonctionnalite(message) {
  return DEBUT_CONVENTIONNEL.exec(message.split('\n')[0])?.[1] === 'feat'
}

/**
 * @param {[number, number, number]} depart la version de l'étiquette de base
 * @param {string[]} messages les commits qui la suivent, du plus ancien au plus récent
 */
export function versionApres(depart, messages) {
  let [majeure, mineure, patch] = depart
  for (const message of messages) {
    if (casseLExistant(message)) {
      majeure += 1
      mineure = 0
      patch = 0
    } else if (apporteUneFonctionnalite(message)) {
      mineure += 1
      patch = 0
    } else {
      patch += 1
    }
  }
  return `${majeure}.${mineure}.${patch}`
}

// `execFileSync` et non `execSync` : le motif `v[0-9]*.[0-9]*.[0-9]*` passe
// par un shell sous `execSync`, et sous Windows cmd.exe ne retire pas les
// apostrophes - git recevait alors un motif entre guillemets, qui ne
// correspondait à rien. Sans shell, l'argument arrive tel quel partout.
function git(...arguments_) {
  return execFileSync('git', arguments_, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

/** Le numéro du commit courant, calculé depuis le dépôt. */
export function versionDuDepot() {
  const etiquette = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*').trim()
  const depart = lireEtiquette(etiquette)
  if (!depart) throw new Error(`Étiquette de départ illisible : « ${etiquette} »`)
  // Un caractère nul sépare les messages : un corps de commit contient des
  // lignes vides, des tirets et des deux-points, mais jamais d'octet nul.
  const messages = git('log', '--format=%B%x00', `${etiquette}..HEAD`)
    .split('\0')
    .map((message) => message.trim())
    .filter(Boolean)
    .reverse()
  return versionApres(depart, messages)
}

// Appelé en ligne de commande (le workflow de déploiement, vite.config.ts) :
// écrit le numéro sur la sortie standard, et rien d'autre.
if (process.argv[1]?.endsWith('version.mjs')) {
  try {
    process.stdout.write(versionDuDepot())
  } catch (cause) {
    process.stderr.write(
      `Impossible de calculer la version : ${cause.message}\n` +
        "Il faut l'historique ET les étiquettes (fetch-depth: 0), et au moins une étiquette vX.Y.Z.\n",
    )
    process.exit(1)
  }
}
