import { readFileSync } from 'node:fs'
import { expect, test, type Browser } from '@playwright/test'
import { serieAvecEdition } from './amorcage'
import { CODE_INVITATION } from './compte'

/**
 * <b>Take one's collection away, lose it, get it back.</b>
 *
 * <p>"Emporter ma collection" promises that one can leave with one's data;
 * "Restaurer une collection" promises that one can come back with it. Batch
 * 115 played this return by hand - export, destroyed stack, import - and it
 * is the journey that it called for. The throwaway stack is unique, we do not
 * destroy it in the middle of a suite: what is destroyed here is the
 * <b>account</b>, by the administrator - and this is exactly what a deletion
 * takes away (see GestionDesComptes), without touching the catalog, which is
 * shared.
 *
 * <p>What this journey checks and nothing else checks: that the downloaded
 * file is indeed the one that the import can read; that a deleted account
 * leaves nothing behind - neither its ownerships nor its session; that an
 * import recreates the collection <b>as it was</b>, progress included; and
 * that the same file sent a second time creates nothing.
 *
 * <p>A second account is created for the occasion, with the invitation code
 * of the stack: the account of the suite is the administrator, and an
 * administrator cannot delete itself.
 */

const ORIGINE = 'http://localhost:5174'

const COMPTE_B = {
  email: 'sauvegarde@iozycore.test',
  motDePasse: 'un-mot-de-passe-b',
  pseudo: 'compte-sauvegarde',
}

/** Creates account B in a new context - or recreates it, once deleted. */
async function creerLeCompteB(browser: Browser) {
  const contexte = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await contexte.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: 'Créer un compte avec une invitation' }).click()
  await page.getByLabel('Adresse e-mail').fill(COMPTE_B.email)
  await page.getByLabel('Mot de passe').fill(COMPTE_B.motDePasse)
  await page.getByLabel('Pseudo').fill(COMPTE_B.pseudo)
  await page.getByLabel('Code d’invitation').fill(CODE_INVITATION)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible()
  await expect(page.getByText("Rien ici pour l'instant.")).toBeVisible()
  return { contexte, page }
}

test('export one\'s collection, lose one\'s account, restore it', async ({ page, browser }) => {
  const titre = `Monster ${Date.now()}`

  // --- An account, and a collection that has something to lose: two owned
  //     volumes out of four, a reference edition with its price.
  const avant = await creerLeCompteB(browser)
  const { entityId } = await serieAvecEdition(avant.page, {
    titre,
    edition: 'Perfect',
    totalVolumes: 4,
    tomesPossedes: [1, 2],
    prixNeufAuTome: 12.5,
  })
  await avant.page.goto('/')
  await expect(avant.page.getByRole('button', { name: new RegExp(`${titre}.*2/4 tomes`) })).toBeVisible()

  // --- Take away: the file is the button's one, not a separate API call
  await avant.page.goto('/profile')
  const [telechargement] = await Promise.all([
    avant.page.waitForEvent('download'),
    avant.page.getByRole('link', { name: 'Télécharger en JSON' }).click(),
  ])
  const fichier = test.info().outputPath('export.json')
  await telechargement.saveAs(fichier)

  const contenu = readFileSync(fichier, 'utf8')
  const document = JSON.parse(contenu) as {
    entities: { title: string }[]
    ownerships: { entityId: string }[]
  }
  expect(document.entities.map((e) => e.title)).toContain(titre)
  expect(document.ownerships.filter((o) => o.entityId === entityId)).toHaveLength(2)
  // A collection, not an account: nothing that allows impersonating it.
  expect(contenu).not.toContain(COMPTE_B.email)
  expect(contenu).not.toContain(COMPTE_B.motDePasse)

  // --- Lose: the administrator deletes the account, and everything it contains
  await page.goto('/administration/comptes')
  await page.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText(`Supprimer définitivement le compte « ${COMPTE_B.pseudo} »`)).toBeVisible()
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click()
  await expect(page.getByText(COMPTE_B.pseudo, { exact: true })).toHaveCount(0)

  // The session of the deleted account does not survive its deletion.
  await avant.page.goto('/')
  await expect(avant.page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await avant.contexte.close()

  // --- Come back: the same account, recreated, finds nothing of itself;
  //     the work, on the other hand, is still in the catalog - and not owned.
  const apres = await creerLeCompteB(browser)
  await apres.page.goto('/add')
  await expect(apres.page.getByRole('button', { name: titre })).toContainText('Pas encore possédé')

  // --- Restore: first what the import would do, then do it
  await apres.page.goto('/profile')
  await apres.page.getByRole('link', { name: 'Importer un fichier' }).click()
  await expect(apres.page).toHaveURL(/\/profile\/import$/)
  await apres.page.getByLabel('Fichier d’export (.json)').setInputFiles(fichier)
  await expect(apres.page.getByRole('heading', { name: 'Ce que l’import ferait' })).toBeVisible()
  await expect(apres.page.getByText(/\d+ élément\(s\) seraient ajoutés/)).toBeVisible()
  await apres.page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(apres.page.getByRole('heading', { name: 'Import terminé' })).toBeVisible()
  await expect(apres.page.getByText(/\d+ élément\(s\) ajouté\(s\) à ta collection\./)).toBeVisible()

  // The collection is back as it was: the two volumes, and the progress that
  // assumes that each volume found its edition again.
  await apres.page.goto('/')
  await expect(apres.page.getByRole('button', { name: new RegExp(`${titre}.*2/4 tomes`) })).toBeVisible()
  await apres.page.getByRole('button', { name: new RegExp(titre) }).click()
  await expect(apres.page.getByRole('heading', { name: titre })).toBeVisible()
  await expect(apres.page.getByText('2/4')).toBeVisible()
  await expect(apres.page.getByRole('button', { name: 'Tome 2, possédé' })).toBeVisible()
  await expect(apres.page.getByRole('button', { name: 'Tome 3, manquant' })).toBeVisible()

  // --- The same file, sent again: nothing to create, everything is found -
  //     so nothing would be duplicated. Only the purchase analysis
  //     preferences are still offered, because they are replaced instead of
  //     added (see ImportPage): this is the only reason why the screen does
  //     not say "il n'y a rien à ajouter".
  await apres.page.goto('/profile/import')
  await apres.page.getByLabel('Fichier d’export (.json)').setInputFiles(fichier)
  await expect(apres.page.getByText('0 élément(s) seraient ajoutés.')).toBeVisible()
  await expect(apres.page.getByRole('row', { name: /^Possessions/ })).toHaveText(/Possessions\s*0\s*2\s*0/)
  // The catalog is shared: the export also takes the works of the other
  // journeys of the suite, all found again. What matters is the zero to
  // create and the zero ignored, not how many were already there.
  await expect(apres.page.getByRole('row', { name: /^Oeuvres et tomes/ })).toHaveText(/Oeuvres et tomes\s*0\s*\d+\s*0/)

  const possessions = await (await apres.page.request.get(`${ORIGINE}/api/ownerships?entityId=${entityId}`)).json()
  expect(possessions).toHaveLength(2)

  await apres.contexte.close()
})
