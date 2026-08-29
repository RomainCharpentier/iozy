/**
 * Le compte au nom duquel les parcours se jouent, et où sa session est rangée.
 *
 * <p>Un module à part, et non une constante exportée par
 * {@code compte.setup.ts} : Playwright refuse qu'un fichier de test en importe
 * un autre, et il a raison - deux fichiers qui s'importent se lancent
 * mutuellement, et l'ordre devient un accident.
 */
export const COMPTE = {
  email: 'e2e@iozycore.test',
  motDePasse: 'un-mot-de-passe-e2e',
  // Un pseudo, donc sans espace ni arobase (voir AppUser côté serveur) : « Compte E2E » serait refusé.
  pseudo: 'compte-e2e',
}

/** Rangée sur le disque, rejouée par chaque parcours (voir playwright.config.ts). */
export const FICHIER_DE_SESSION = 'e2e/.auth/session.json'
