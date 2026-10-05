/**
 * Which number the current commit carries — Major.Minor.Patch.
 *
 * <h2>The number is DEDUCED from the commits</h2>
 * This repository has written its messages in Conventional Commits from the
 * start (`feat(version): …`, `fix(deploiement): …`): the nature of each
 * change is therefore already written, and it is exactly what a semantic
 * number must say. Deducing it rather than setting it by hand avoids the only
 * flaw of a manual version: the one we forget to increment on an evening of
 * quick fixes, which passes two different releases off as the same one.
 *
 * <h2>The rule, in three lines</h2>
 * <ul>
 *   <li>a commit that BREAKS (`feat!:`, or `BREAKING CHANGE:` in the message
 *       footer) → Major + 1, the rest to zero;</li>
 *   <li>`feat:` → Minor + 1, Patch to zero;</li>
 *   <li>everything else — `fix`, `perf`, `refactor`, `docs`, `test`, `chore`… →
 *       Patch + 1.</li>
 * </ul>
 *
 * <p>The last point is a choice, and it has a cost: `docs:` is not a fix. But
 * a deployed commit that moved NO digit would give two different releases
 * with the same number — precisely what this number exists to avoid.
 * Anything that ships deserves at least a patch.
 *
 * <h2>The starting point is a tag, and a human decision is enough for it</h2>
 * We start again from the last reachable `vX.Y.Z` tag, and we apply only the
 * commits that follow it. Normally the previous deployment set it, so the
 * calculation is short. But setting `git tag -a v2.0.0` by hand is enough to
 * decide a new course: the calculation starts again from there, without a
 * single line of this file having to know.
 *
 * <h2>No tag, no number</h2>
 * Without a starting tag, this script FAILS instead of starting again from
 * 1.0.0: it is the sign of a shallow clone or of tags that were not fetched,
 * and a number that goes backwards reads exactly like a number that goes
 * forward.
 */
import { execFileSync } from 'node:child_process'

const DEBUT_CONVENTIONNEL = /^([a-z]+)(\([^)]*\))?(!)?:/

/** `v1.4.2` → `[1, 4, 2]`. Returns `null` for everything else. */
export function lireEtiquette(etiquette) {
  const trouve = /^v(\d+)\.(\d+)\.(\d+)$/.exec(etiquette.trim())
  return trouve ? [Number(trouve[1]), Number(trouve[2]), Number(trouve[3])] : null
}

/** A commit that breaks existing behavior, in both spellings of the convention. */
export function casseLExistant(message) {
  const [sujet, ...corps] = message.split('\n')
  if (DEBUT_CONVENTIONNEL.exec(sujet)?.[3] === '!') return true
  return corps.some((ligne) => /^BREAKING[ -]CHANGE:/.test(ligne.trim()))
}

/** `feat:` and only it — `feat!` has already gone to the major. */
export function apporteUneFonctionnalite(message) {
  return DEBUT_CONVENTIONNEL.exec(message.split('\n')[0])?.[1] === 'feat'
}

/**
 * @param {[number, number, number]} depart the version of the base tag
 * @param {string[]} messages the commits that follow it, from oldest to newest
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

// `execFileSync` and not `execSync`: the pattern `v[0-9]*.[0-9]*.[0-9]*` goes
// through a shell under `execSync`, and on Windows cmd.exe does not remove
// the apostrophes - git then received a quoted pattern, which matched
// nothing. Without a shell, the argument arrives as is everywhere.
function git(...arguments_) {
  return execFileSync('git', arguments_, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

/** The number of the current commit, computed from the repository. */
export function versionDuDepot() {
  const etiquette = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*.[0-9]*.[0-9]*').trim()
  const depart = lireEtiquette(etiquette)
  if (!depart) throw new Error(`Unreadable starting tag: "${etiquette}"`)
  // A null character separates the messages: a commit body contains empty
  // lines, dashes and colons, but never a null byte.
  const messages = git('log', '--format=%B%x00', `${etiquette}..HEAD`)
    .split('\0')
    .map((message) => message.trim())
    .filter(Boolean)
    .reverse()
  return versionApres(depart, messages)
}

// Called from the command line (the deployment workflow, vite.config.ts):
// writes the number to the standard output, and nothing else.
if (process.argv[1]?.endsWith('version.mjs')) {
  try {
    process.stdout.write(versionDuDepot())
  } catch (cause) {
    process.stderr.write(
      `Cannot compute the version: ${cause.message}\n` +
        'The history AND the tags are needed (fetch-depth: 0), and at least one vX.Y.Z tag.\n',
    )
    process.exit(1)
  }
}
