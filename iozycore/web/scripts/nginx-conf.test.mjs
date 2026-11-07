/**
 * The nginx rules that fail only in production.
 *
 * The dev server and the e2e stack do not go through nginx.conf, so a missing
 * line here breaks nothing that a test sees: an upload gets a 413, a cookie
 * loses `Secure`, the app can be framed. `nginx -t` checks the syntax, not
 * these rules; `check:deploiement` checks them, but only on a running stack.
 * This test reads the file and keeps each rule in place.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest runs from iozycore/web/ (jsdom gives import.meta.url an http scheme).
const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

const conf = read('nginx.conf')

/** The body of a `location` block, without nested blocks (none here). */
function location(signature) {
  const start = conf.indexOf(`location ${signature} {`)
  expect(start, `location ${signature} not found`).toBeGreaterThanOrEqual(0)
  return conf.slice(start, conf.indexOf('\n    }', start))
}

/** Lines that are not comments, so a rule in a comment does not count. */
function directives(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .join('\n')
}

describe('the API location', () => {
  it('accepts the bodies that the API accepts (13 MB, like max-request-size)', () => {
    const appSettings = read('../backend/src/main/resources/application.yml')
    expect(appSettings).toMatch(/max-request-size:\s*13MB/)
    expect(directives(location('/api/'))).toMatch(/^client_max_body_size 13m;$/m)
  })
})
