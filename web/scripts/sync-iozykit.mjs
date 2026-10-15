import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Copies the IozyKit charter into vendor/iozykit/ (`npm run kit:sync`).
 *
 * A copy, not a dependency: the Docker build on the NAS sees only this
 * folder, and a `file:../../IozyKit` would break `npm ci` there. The copy is
 * tracked by git; VERSION notes the kit commit it reflects, so we always know
 * who is behind. The kit stays the source of truth: never edit
 * vendor/iozykit/ by hand. IozyPlay has the same script.
 *
 * The source is the sibling checkout `../../IozyKit` (seen from web/), or
 * `IOZYKIT_PATH` when the kit lives elsewhere (a git worktree, for example).
 */
const web = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = process.env.IOZYKIT_PATH
  ? resolve(process.env.IOZYKIT_PATH)
  : resolve(web, '..', '..', 'IozyKit')

if (!existsSync(join(source, 'tokens.json'))) {
  console.error(`IozyKit not found at ${source} (set IOZYKIT_PATH=...).`)
  process.exit(1)
}

// tokens.css is generated: rebuild it first, so the copy never lags behind
// tokens.json.
execSync('node scripts/build-css.mjs', { cwd: source, stdio: 'inherit' })

const target = join(web, 'vendor', 'iozykit')
mkdirSync(target, { recursive: true })
cpSync(join(source, 'css'), join(target, 'css'), { recursive: true })
cpSync(join(source, 'tokens.json'), join(target, 'tokens.json'))

// The commit the copy reflects. `-dirty` when what was copied differs from
// that commit: VERSION would otherwise name a commit that does not hold it.
// `git diff` and not `git status`: the build above rewrites tokens.css with
// LF, which `status` reports as modified on a CRLF checkout even when the
// content is the same.
let ref = 'unknown'
try {
  const git = (args) =>
    execSync(`git ${args}`, { cwd: source, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  ref = git('rev-parse --short HEAD')
  try {
    git('diff --quiet HEAD -- tokens.json css')
  } catch {
    ref += '-dirty'
  }
} catch {
  // No git on the kit side: the date alone says when the copy was made.
}
writeFileSync(join(target, 'VERSION'), `${ref} ${new Date().toISOString().slice(0, 10)}\n`)
console.log(`IozyKit ${ref} copied to web/vendor/iozykit/`)
