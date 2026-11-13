import { expect, test, type Browser } from '@playwright/test'
import { serieAvecEdition } from './amorcage'
import { CODE_INVITATION } from './compte'

/**
 * The home page, "le mur" (lot 219), on an account of its own.
 *
 * <p>The account of the suite is shared by every journey: its wall is
 * whatever the other files added before this one. A new account is the only
 * place where the wall is surely empty, then surely filled by what this test
 * adds. It is deleted at the end, by the administrator, as in
 * import.spec.ts - which counts on being the only account to delete.
 *
 * <p>The stack has no model key: no idea comes, and the wall says nothing of
 * them. What is checked is the journey of a series to complete, from its
 * block to "J'ai le tome 4" on the back of the tile.
 */
const COMPTE_ACCUEIL = {
  email: 'accueil-e2e@iozycore.test',
  motDePasse: 'un-mot-de-passe-accueil',
  pseudo: 'accueil-e2e',
}

async function creerLeCompte(browser: Browser) {
  const contexte = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await contexte.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: 'Créer un compte avec une invitation' }).click()
  await page.getByLabel('Adresse e-mail').fill(COMPTE_ACCUEIL.email)
  await page.getByLabel('Mot de passe').fill(COMPTE_ACCUEIL.motDePasse)
  await page.getByLabel('Pseudo').fill(COMPTE_ACCUEIL.pseudo)
  await page.getByLabel('Code d’invitation').fill(CODE_INVITATION)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  return { contexte, page }
}

test('a new wall is empty, then follows a series to complete until it is', async ({ page, browser }) => {
  const titre = `Mur ${Date.now()}`
  const compte = await creerLeCompte(browser)
  try {
    const accueil = compte.page

    // --- A new account: one big place, and where to start
    await expect(accueil.getByRole('heading', { name: /Ta première jaquette/ })).toBeVisible()
    await expect(accueil.getByRole('link', { name: 'Chercher un titre' })).toBeVisible()

    // --- Three volumes out of four: the fourth is missing
    await serieAvecEdition(accueil, { titre, edition: 'Standard', totalVolumes: 4, tomesPossedes: [1, 2, 3] })
    await accueil.goto('/')

    // The poster counts it, and the wall shows the series as one block.
    await expect(accueil.getByRole('heading', { name: '1 chose à suivre' })).toBeVisible()
    await expect(accueil.getByText('tome à acheter pour finir 1 série.')).toBeVisible()
    const bloc = accueil.getByRole('button', { name: `${titre} : Le dernier qui te manque` })
    await expect(bloc).toBeVisible()
    // A block of colour says the same in a figure, and leads to what there is to buy.
    await expect(accueil.getByRole('link', { name: `1 tome et ${titre} est à jour.` })).toBeVisible()

    // --- A click on the cover turns the tile: why it is there, and its one action
    await bloc.click()
    const dos = accueil.getByRole('group', { name: titre })
    await expect(dos.getByText('Tome 4.')).toBeVisible()
    // The focus goes to the back, and Escape turns it back.
    await expect(dos.getByRole('link', { name: titre })).toBeFocused()
    await accueil.keyboard.press('Escape')
    await expect(bloc).toBeFocused()

    await bloc.click()
    await accueil.getByRole('group', { name: titre }).getByRole('button', { name: 'J’ai le tome 4' }).click()
    await expect(accueil.getByText(`${titre}, tome 4 : dans ta collection`)).toBeVisible()

    // Complete now: no longer a series to complete, an arrival of today.
    await expect(bloc).toHaveCount(0)
    await expect(accueil.getByRole('button', { name: `${titre} : Arrivé aujourd’hui` })).toBeVisible()

    // The title on the back opens the work.
    await accueil.getByRole('button', { name: `${titre} : Arrivé aujourd’hui` }).click()
    await accueil.getByRole('group', { name: titre }).getByRole('link', { name: titre }).click()
    await expect(accueil).toHaveURL(/\/entity\/[0-9a-f-]{36}$/)
    await expect(accueil.getByRole('heading', { name: titre })).toBeVisible()
  } finally {
    await compte.contexte.close()
    // --- Leave the instance as it was: one account to delete for import.spec.ts
    await page.goto('/administration/comptes')
    await page.getByRole('button', { name: 'Supprimer' }).click()
    await expect(page.getByText(`Supprimer définitivement le compte « ${COMPTE_ACCUEIL.pseudo} »`)).toBeVisible()
    await page.getByRole('button', { name: 'Confirmer la suppression' }).click()
    await expect(page.getByText(COMPTE_ACCUEIL.pseudo, { exact: true })).toHaveCount(0)
  }
})
