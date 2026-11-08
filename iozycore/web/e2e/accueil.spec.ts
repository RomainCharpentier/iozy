import { expect, test, type Browser } from '@playwright/test'
import { serieAvecEdition } from './amorcage'
import { CODE_INVITATION } from './compte'

/**
 * The home page "ta semaine" (lot 212), on an account of its own.
 *
 * <p>The account of the suite is shared by every journey: its week is
 * whatever the other files added before this one. A new account is the only
 * place where every block is surely empty, then surely filled by what this
 * test adds. It is deleted at the end, by the administrator, as in
 * import.spec.ts - which counts on being the only account to delete.
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

test('a new week is empty block by block, then shows what was added', async ({ page, browser }) => {
  const titre = `Semaine ${Date.now()}`
  const compte = await creerLeCompte(browser)
  try {
    const accueil = compte.page

    // --- A new account: the shape of the week, and where to start
    await expect(accueil.getByRole('heading', { name: 'Ta semaine', exact: true })).toBeVisible()
    await expect(accueil.getByText('Ta semaine commence ici.')).toBeVisible()
    await expect(accueil.getByText("Rien d'autre cette semaine.")).toBeVisible()
    await expect(accueil.getByText("Aucun objet pour l'instant.")).toBeVisible()
    await expect(accueil.getByText("Rien de presque fini pour l'instant.")).toBeVisible()
    await expect(accueil.getByText('Tes rayons sont vides.')).toBeVisible()

    // --- Three volumes out of four: the work moved last, one is missing
    await serieAvecEdition(accueil, { titre, edition: 'Standard', totalVolumes: 4, tomesPossedes: [1, 2, 3] })
    await accueil.goto('/')

    // The lead: the work that moved last, where the collector stands.
    await expect(accueil.getByRole('heading', { name: titre, exact: true })).toBeVisible()
    await expect(accueil.getByText(/Tu en as 3 sur 4\./).first()).toBeVisible()
    // The number: the objects of the collection.
    await expect(accueil.getByText(/objets dans ta collection./).first()).toBeVisible()
    // Almost done: the missing volume, which leads to the detail page.
    await expect(accueil.getByRole('link', { name: `${titre} : il n'en manque plus qu'un.` })).toBeVisible()
    await accueil.getByRole('link', { name: "Tome 4 : l'ajouter depuis la fiche" }).click()
    await expect(accueil).toHaveURL(/\/entity\/[0-9a-f-]{36}$/)
    await expect(accueil.getByRole('heading', { name: titre })).toBeVisible()

    // The shelves: the category, its counts, and the whole collection.
    await accueil.goto('/')
    await expect(accueil.getByText('1 œuvre · 3 objets')).toBeVisible()
    await accueil.getByRole('link', { name: /Toute ma collection/ }).click()
    await expect(accueil).toHaveURL(/\/collection$/)
    await expect(accueil.getByRole('heading', { name: 'Ma collection' })).toBeVisible()
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
