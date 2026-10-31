// Stop hook: when code changed in an app, run its real checks before the turn can end.
// Exit code 2 blocks the stop and sends stderr back to Claude. Anything else lets it end.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// One entry per app: its folder and the npm scripts that must pass.
// iozykit is left out on purpose: its test rewrites a generated file, so the
// hook would see "changes" for ever. Backend tests need Docker and are too slow here.
const apps = [
  { dir: 'iozycore/web', scripts: ['typecheck', 'lint'] },
  { dir: 'iozyplay', scripts: ['typecheck', 'test:unit'] },
]

function changedCode(dir) {
  const out = execFileSync('git', ['status', '--porcelain', '--', dir], { cwd: root, encoding: 'utf8' })
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .filter((path) => !path.endsWith('.md'))
}

function run(dir, script) {
  const result = spawnSync('npm', ['run', script], { cwd: join(root, dir), encoding: 'utf8', shell: true })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n')
  return { ok: result.status === 0, output }
}

const reports = []
for (const { dir, scripts } of apps) {
  if (changedCode(dir).length === 0) continue
  // A fresh worktree has no node_modules yet: the checks could only fail for that reason.
  if (!existsSync(join(root, dir, 'node_modules'))) continue
  for (const script of scripts) {
    const result = run(dir, script)
    if (!result.ok) reports.push(`--- ${dir}: npm run ${script} failed ---\n${result.output}`)
  }
}

if (reports.length > 0) {
  process.stderr.write(`Code changed and checks fail. Fix them before finishing.\n\n${reports.join('\n\n')}\n`)
  process.exit(2)
}
