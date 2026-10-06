// PreToolUse guard: blocks the mistakes that CLAUDE.md only asks us not to make.
// Exit code 2 blocks the call and sends stderr back to Claude.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const input = JSON.parse(readFileSync(0, 'utf8'))
const tool = input.tool_name
const args = input.tool_input ?? {}

function block(message) {
  process.stderr.write(message + '\n')
  process.exit(2)
}

function isTracked(path) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', path], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (tool === 'Edit' || tool === 'Write') {
  const path = String(args.file_path ?? '').replaceAll(String.fromCharCode(92), '/')
  if (/\/db\/migration\/V\d+__[^/]+\.sql$/.test(path) && isTracked(path)) {
    block(
      'Blocked: this Flyway migration is already committed. Changing it, even a comment, ' +
        'breaks its checksum. Add a new V{n}__description.sql instead.',
    )
  }
}

if (tool === 'Bash') {
  const command = String(args.command ?? '')
  if (/\btsc\b[^|;&]*--noEmit/.test(command) && !/npm run/.test(command)) {
    block('Blocked: `tsc --noEmit` checks nothing here (root tsconfig has files: []). Run `npm run typecheck` in web/.')
  }
  if (/\bgit\s+push\b[^|;&]*(--force\b|--force-with-lease\b|\s-f\b)/.test(command)) {
    block('Blocked: never force-push in this repo.')
  }
}
