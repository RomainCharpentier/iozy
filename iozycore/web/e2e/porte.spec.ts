import { expect, test } from '@playwright/test'
import { COMPTE } from './compte'

/**
 * <b>Get in and out, for real.</b>
 *
 * These tests start <b>anonymous</b> — that is their whole point. The other
 * journeys replay an already opened session; these check that it can be
 * opened, that a wrong password does not open it, and that closing it really
 * closes it on the server side.
 *
 * <p>Each test opens its OWN session: logging out invalidates a session on the
 * server side, and borrowing the one of the other tests would break them all.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test('without an account, nothing of the collection is displayed', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  // No navigation, no counter, no work title: the door replaces the screen,
  // it is not laid over it.
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toHaveCount(0)
})

test('one more account requires the invitation code, and a wrong code is refused', async ({ page }) => {
  // The first account exists (see compte.setup): from then on, the door has a
  // key. The screen offers to create an account because the stack configured
  // one (see docker-compose.e2e.yml) - without a configured code, it would
  // offer nothing at all, which would only open a refusal.
  await page.goto('/')
  await page.getByRole('button', { name: 'Créer un compte avec une invitation' }).click()
  await page.getByLabel('Adresse e-mail').fill('intrus@iozycore.test')
  await page.getByLabel('Mot de passe').fill('un-mot-de-passe-intrus')
  await page.getByLabel('Pseudo').fill('intrus')
  await page.getByLabel('Code d’invitation').fill('pas-le-bon-code')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  await expect(page.getByText("Code d'invitation invalide.")).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toHaveCount(0)
})

test('a wrong password does not say whether the address exists', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse e-mail').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill('ce-n-est-pas-le-bon')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  const refusMotDePasse = await page.getByText('Adresse ou mot de passe incorrect.').textContent()

  await page.getByLabel('Adresse e-mail').fill('personne@iozycore.test')
  await page.getByLabel('Mot de passe').fill('ce-n-est-pas-le-bon')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // The same message, word for word: telling them apart would offer an
  // account existence test to whoever has none.
  await expect(page.getByText('Adresse ou mot de passe incorrect.')).toHaveText(refusMotDePasse ?? '')
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toHaveCount(0)
})

test('logging in then logging out really closes', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse e-mail').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible()

  // By the PATH, not by the URL: avatar ▸ Profil, where "Mon compte" is read
  // directly (batch 140: no more Paramètres subscreen), and the exit is in the
  // header, the same button on all screens.
  await page.getByRole('link', { name: new RegExp(`Mon profil — ${COMPTE.pseudo}`) }).first().click()
  await expect(page.getByRole('region', { name: 'Mon compte' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Paramètres/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()

  // And the session is dead ON THE SERVER SIDE, not only erased on the screen:
  // going back to the collection does not reopen it.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
})
