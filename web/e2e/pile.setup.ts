import { execFileSync } from 'node:child_process'

/**
 * Démarre la pile jetable avant le premier test.
 *
 * <p>`--wait` attend les contrôles de santé, pas le simple démarrage des
 * conteneurs : l'API n'est déclarée prête que lorsqu'elle RÉPOND, migrations
 * Flyway comprises. Sans ça, le premier test frapperait une API qui démarre
 * encore, et échouerait pour une raison qui n'a rien à voir avec lui.
 *
 * <p>Le premier lancement construit l'image (une à deux minutes) ; les suivants
 * repartent du cache Docker.
 */
export default function demarrerLaPile() {
  console.log('E2E : démarrage de la pile jetable (base + API sur :8090)…')
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
