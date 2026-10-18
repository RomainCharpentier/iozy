import { execFileSync } from 'node:child_process'

/**
 * Starts the throwaway stack before the first test.
 *
 * <p>`--wait` waits for the health checks, not just the start of the
 * containers: the API is declared ready only when it ANSWERS, Flyway
 * migrations included. Without it, the first test would hit an API that is
 * still starting, and would fail for a reason that has nothing to do with it.
 *
 * <p>The first run builds the image (one to two minutes); the following ones
 * start again from the Docker cache.
 */
export default function demarrerLaPile() {
  console.log('E2E: starting the throwaway stack (database + API on :8090)…')
  execFileSync(
    'docker',
    [
      'compose',
      '-p',
      'iozycore-e2e',
      '-f',
      'docker-compose.e2e.yml',
      'up',
      '-d',
      '--build',
      '--wait',
    ],
    { cwd: '../backend', stdio: 'inherit' },
  )
}
