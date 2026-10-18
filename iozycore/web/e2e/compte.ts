/**
 * The account in whose name the journeys are played, and where its session is stored.
 *
 * <p>A separate module, and not a constant exported by
 * {@code compte.setup.ts}: Playwright refuses that a test file imports
 * another one, and it is right - two files that import each other start each
 * other, and the order becomes an accident.
 */
export const COMPTE = {
  email: 'e2e@iozycore.test',
  motDePasse: 'un-mot-de-passe-e2e',
  // A username, so no space and no at sign (see AppUser on the server side): "Compte E2E" would be refused.
  pseudo: 'compte-e2e',
}

/** Stored on the disk, replayed by each journey (see playwright.config.ts). */
export const FICHIER_DE_SESSION = 'e2e/.auth/session.json'

/**
 * The invitation code of the throwaway stack (see backend/docker-compose.e2e.yml).
 *
 * <p>The first account does not need one; every FOLLOWING account requires it,
 * and this is what allows a journey to create a second one - the import of a
 * backup is checked on an account that can be deleted, which the administrator
 * of the suite cannot do to itself. A wrong code is still refused (see
 * porte.spec.ts): the door is not open, it has a key, and the key is known to
 * the suite.
 */
export const CODE_INVITATION = 'code-e2e'
