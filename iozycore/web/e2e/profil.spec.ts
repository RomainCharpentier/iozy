import { expect, test } from '@playwright/test'
import { CODE_INVITATION } from './compte'

/**
 * The common profile (lot 218): the pseudo changes in place, and the avatar
 * of the top bar says the new one at once - then still after a reload, so
 * it was saved on the account and not only in the cache of the page.
 *
 * <p>An account created for the occasion, with the invitation code of the
 * stack: renaming the account of the suite would break every journey that
 * looks for "Mon profil — compte-e2e".
 */
test('change the pseudo, and the avatar says the new one', async ({ browser }) => {
  const suffixe = String(Date.now()).slice(-6)
  const avant = `profil-${suffixe}`
  const apres = `Neo_Renomme${suffixe}`

  const contexte = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await contexte.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: 'Créer un compte avec une invitation' }).click()
  await page.getByLabel('Adresse e-mail').fill(`profil-${suffixe}@iozycore.test`)
  await page.getByLabel('Mot de passe').fill('un-mot-de-passe-profil')
  await page.getByLabel('Pseudo').fill(avant)
  await page.getByLabel('Code d’invitation').fill(CODE_INVITATION)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: /Ta première jaquette/ })).toBeVisible()

  // By the avatar, as a person would.
  await page.getByRole('link', { name: `Mon profil — ${avant}` }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: avant })).toBeVisible()

  await page.getByRole('button', { name: 'Modifier le pseudo' }).click()
  await page.getByLabel('Nouveau pseudo').fill(apres)
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page.getByRole('heading', { level: 1, name: apres })).toBeVisible()
  const avatar = page.getByRole('link', { name: `Mon profil — ${apres}` }).first()
  await expect(avatar).toBeVisible()
  // The initials follow too: "Neo_Renomme…" reads NR.
  await expect(avatar).toHaveText('NR')

  // Saved on the account, not only in the page: a reload reads it again.
  await page.reload()
  await expect(page.getByRole('link', { name: `Mon profil — ${apres}` }).first()).toBeVisible()

  // A pseudo with a space is refused, with the rule.
  await page.getByRole('button', { name: 'Modifier le pseudo' }).click()
  await page.getByLabel('Nouveau pseudo').fill('deux mots')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'sans espace ni arobase' })).toBeVisible()

  await contexte.close()
})
