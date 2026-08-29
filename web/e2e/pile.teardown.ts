import { execFileSync } from 'node:child_process'

/**
 * Éteint la pile jetable, <b>volumes compris</b>.
 *
 * <p>`-v` est ce qui rend la suite reproductible : la base repart vide au
 * lancement suivant, donc le premier test retrouve toujours une instance sans
 * compte. Sans lui, le deuxième lancement échouerait sur « créer le premier
 * compte » — un test vert qui devient rouge sans qu'une ligne de code n'ait
 * bougé.
 *
 * <p>Garder la pile pour inspecter après un échec :
 * {@code IOZYCORE_E2E_GARDER_LA_PILE=1 npm run test:e2e}.
 */
export default function eteindreLaPile() {
  if (process.env.IOZYCORE_E2E_GARDER_LA_PILE) {
    console.log('E2E : pile laissée en place (IOZYCORE_E2E_GARDER_LA_PILE).')
    console.log('      docker compose -p iozycore-e2e -f docker-compose.e2e.yml down -v')
    return
  }
  execFileSync('docker', ['compose', '-p', 'iozycore-e2e', '-f', 'docker-compose.e2e.yml', 'down', '-v'], {
    cwd: '../backend',
    stdio: 'inherit',
  })
}
