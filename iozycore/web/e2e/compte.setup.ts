import { expect, test as setup } from '@playwright/test'
import { COMPTE, FICHIER_DE_SESSION } from './compte'

/**
 * Creates the first account — and hands its session to the other journeys.
 *
 * <h2>Why this is a "setup" and not a test like the others</h2>
 * All the other journeys start logged in. Sending them all through the login
 * screen would add the same start ten times, and above all ten ways to fail
 * it. Here, the session is opened once, stored on the disk, and replayed by
 * each test — this is the standard Playwright pattern.
 *
 * <p>The door itself is still tested, but anonymously and for real (see
 * {@code porte.spec.ts}): this file is not here to check it, it is here to
 * open it.
 */


setup('create the first account of this instance', async ({ page }) => {
  await page.goto('/')

  // A new instance has nobody: it offers to create, not to log in. This
  // sentence can only come from a call to /api/auth/etat that was really
  // routed - so it also checks the proxy.
  await expect(page.getByText('Personne n’a encore de compte ici')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible()

  await page.getByLabel('Adresse e-mail').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByLabel('Pseudo').fill(COMPTE.pseudo)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  // Creating logs in with the same gesture: we arrive in the application, not
  // on a login screen that would ask again for what we just typed.
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible()
  await expect(page.getByText("Rien ici pour l'instant.")).toBeVisible()

  // And the header says in whose name: the avatar carries the initials of the
  // username, not those of the application.
  await expect(page.getByRole('link', { name: `Mon profil — ${COMPTE.pseudo}` }).first()).toHaveText('CE')

  await page.context().storageState({ path: FICHIER_DE_SESSION })
})
