// Stop hook: when web/ code changed, run the real checks before the turn can end.
// Exit code 2 blocks the stop and sends stderr back to Claude. Anything else lets it end.
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const web = join(root, 'web')

function changedWebCode() {
  const out = execFileSync('git', ['status', '--porcelain', '--', 'web'], { cwd: root, encoding: 'utf8' })
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((path) => !path.endsWith('.md'))
}

function run(script) {
  const result = spawnSync('npm', ['run', script], { cwd: web, encoding: 'utf8', shell: true })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n')
  return { ok: result.status === 0, output }
}

if (changedWebCode().length === 0) process.exit(0)

const failures = ['typecheck', 'lint']
  .map((script) => ({ script, ...run(script) }))
  .filter((check) => !check.ok)

if (failures.length > 0) {
  const report = failures.map((f) => `--- npm run ${f.script} failed ---\n${f.output}`).join('\n\n')
  process.stderr.write(`web/ changed and checks fail. Fix them before finishing.\n\n${report}\n`)
  process.exit(2)
}
