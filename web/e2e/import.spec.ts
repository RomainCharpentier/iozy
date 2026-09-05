import { readFileSync } from 'node:fs'
import { expect, test, type Browser } from '@playwright/test'
import { serieAvecEdition } from './amorcage'
import { CODE_INVITATION } from './compte'

/**
 * <b>Emporter sa collection, la perdre, la retrouver.</b>
 *
 * <p>« Emporter ma collection » promet qu'on peut partir avec ses données ;
 * « Restaurer une collection » promet qu'on peut revenir avec. Le lot 115 a
 * joué ce retour à la main - export, pile détruite, import - et c'est le
 * parcours qu'il réclamait. La pile jetable est unique, on ne la détruit
 * pas au milieu d'une suite : ce qui est détruit ici, c'est le <b>compte</b>,
 * par l'administrateur - et c'est exactement ce qu'une suppression emporte
 * (voir GestionDesComptes), sans toucher au catalogue, qui est partagé.
 *
 * <p>Ce que ce parcours vérifie et que rien d'autre ne vérifie : que le
 * fichier téléchargé est bien celui que l'import sait lire ; qu'un compte
 * supprimé ne laisse rien derrière lui - ni ses possessions, ni sa session ;
 * qu'un import recrée la collection <b>telle qu'elle était</b>, progression
 * comprise ; et que le même fichier renvoyé une seconde fois ne crée rien.
 *
 * <p>Un second compte est créé pour l'occasion, avec le code d'invitation de
 * la pile : le compte de la suite est l'administrateur, et un administrateur
 * ne peut pas se supprimer lui-même.
 */

const ORIGINE = 'http://localhost:5174'

const COMPTE_B = {
  email: 'sauvegarde@iozycore.test',
  motDePasse: 'un-mot-de-passe-b',
  pseudo: 'compte-sauvegarde',
}

/** Crée le compte B dans un contexte neuf - ou le recrée, une fois supprimé. */
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

test('exporter sa collection, perdre son compte, la restaurer', async ({ page, browser }) => {
  const titre = `Monster ${Date.now()}`

  // --- Un compte, et une collection qui a de quoi se perdre : deux tomes
  //     possédés sur quatre, une édition de référence avec son prix.
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

  // --- Emporter : le fichier est celui du bouton, pas un appel d'API à part
  await avant.page.goto('/settings')
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
  // Une collection, pas un compte : rien qui permette de se faire passer pour lui.
  expect(contenu).not.toContain(COMPTE_B.email)
  expect(contenu).not.toContain(COMPTE_B.motDePasse)

  // --- Perdre : l'administrateur supprime le compte, et tout ce qu'il contient
  await page.goto('/administration/comptes')
  await page.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText(`Supprimer définitivement le compte « ${COMPTE_B.pseudo} »`)).toBeVisible()
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click()
  await expect(page.getByText(COMPTE_B.pseudo, { exact: true })).toHaveCount(0)

  // La session du compte supprimé ne survit pas à sa suppression.
  await avant.page.goto('/')
  await expect(avant.page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await avant.contexte.close()

  // --- Revenir : le même compte, recréé, ne retrouve rien de lui-même ;
  //     l'œuvre, elle, est toujours au catalogue - et pas possédée.
  const apres = await creerLeCompteB(browser)
  await apres.page.goto('/add')
  await expect(apres.page.getByRole('button', { name: titre })).toContainText('Pas encore possédé')

  // --- Restaurer : d'abord ce que l'import ferait, puis le faire
  await apres.page.goto('/settings')
  await apres.page.getByRole('link', { name: 'Importer un fichier' }).click()
  await expect(apres.page).toHaveURL(/\/settings\/import$/)
  await apres.page.getByLabel('Fichier d’export (.json)').setInputFiles(fichier)
  await expect(apres.page.getByRole('heading', { name: 'Ce que l’import ferait' })).toBeVisible()
  await expect(apres.page.getByText(/\d+ élément\(s\) seraient ajoutés/)).toBeVisible()
  await apres.page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(apres.page.getByRole('heading', { name: 'Import terminé' })).toBeVisible()
  await expect(apres.page.getByText(/\d+ élément\(s\) ajouté\(s\) à ta collection\./)).toBeVisible()

  // La collection est revenue telle qu'elle était : les deux tomes, et la
  // progression qui suppose que chaque tome a retrouvé son édition.
  await apres.page.goto('/')
  await expect(apres.page.getByRole('button', { name: new RegExp(`${titre}.*2/4 tomes`) })).toBeVisible()
  await apres.page.getByRole('button', { name: new RegExp(titre) }).click()
  await expect(apres.page.getByRole('heading', { name: titre })).toBeVisible()
  await expect(apres.page.getByText('2/4')).toBeVisible()
  await expect(apres.page.getByRole('button', { name: 'Tome 2, possédé' })).toBeVisible()
  await expect(apres.page.getByRole('button', { name: 'Tome 3, manquant' })).toBeVisible()

  // --- Le même fichier, renvoyé : rien à créer, tout est retrouvé - donc
  //     rien ne serait dupliqué. Seules les préférences d'analyse d'achat
  //     restent proposées, parce qu'elles se remplacent au lieu de s'ajouter
  //     (voir ImportPage) : c'est la seule raison pour laquelle l'écran ne dit
  //     pas « il n'y a rien à ajouter ».
  await apres.page.goto('/settings/import')
  await apres.page.getByLabel('Fichier d’export (.json)').setInputFiles(fichier)
  await expect(apres.page.getByText('0 élément(s) seraient ajoutés.')).toBeVisible()
  await expect(apres.page.getByRole('row', { name: /^Possessions/ })).toHaveText(/Possessions\s*0\s*2\s*0/)
  // Le catalogue est partagé : l'export emporte aussi les œuvres des autres
  // parcours de la suite, toutes retrouvées. Ce qui compte, c'est le zéro à
  // créer et le zéro ignoré, pas combien étaient déjà là.
  await expect(apres.page.getByRole('row', { name: /^Oeuvres et tomes/ })).toHaveText(/Oeuvres et tomes\s*0\s*\d+\s*0/)

  const possessions = await (await apres.page.request.get(`${ORIGINE}/api/ownerships?entityId=${entityId}`)).json()
  expect(possessions).toHaveLength(2)

  await apres.contexte.close()
})
