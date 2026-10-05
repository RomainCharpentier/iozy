import { execFileSync } from 'node:child_process'

/**
 * Stops the throwaway stack, <b>volumes included</b>.
 *
 * <p>`-v` is what makes the suite reproducible: the database starts empty at
 * the next run, so the first test always finds an instance with no account.
 * Without it, the second run would fail on "create the first account" — a
 * green test that turns red without a single line of code having moved.
 *
 * <p>Keep the stack to inspect after a failure:
 * {@code IOZYCORE_E2E_GARDER_LA_PILE=1 npm run test:e2e}.
 */
export default function eteindreLaPile() {
  if (process.env.IOZYCORE_E2E_GARDER_LA_PILE) {
    console.log('E2E: stack left in place (IOZYCORE_E2E_GARDER_LA_PILE).')
    console.log('      docker compose -p iozycore-e2e -f docker-compose.e2e.yml down -v')
    return
  }
  execFileSync('docker', ['compose', '-p', 'iozycore-e2e', '-f', 'docker-compose.e2e.yml', 'down', '-v'], {
    cwd: '../backend',
    stdio: 'inherit',
  })
}
