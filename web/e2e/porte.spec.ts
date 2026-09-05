import { expect, test } from '@playwright/test'
import { COMPTE } from './compte'

/**
 * <b>Entrer et sortir, pour de vrai.</b>
 *
 * Ces tests partent <b>anonymes</b> — c'est tout leur intérêt. Les autres
 * parcours rejouent une session déjà ouverte ; ceux-ci vérifient qu'on peut
 * l'ouvrir, qu'un mauvais mot de passe ne l'ouvre pas, et que la refermer la
 * referme vraiment côté serveur.
 *
 * <p>Chaque test ouvre sa PROPRE session : se déconnecter invalide une session
 * côté serveur, et emprunter celle des autres tests les casserait tous.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test('sans compte, rien de la collection ne s’affiche', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  // Ni navigation, ni compteur, ni titre d'œuvre : la porte remplace l'écran,
  // elle ne se pose pas dessus.
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toHaveCount(0)
})

test('un compte de plus exige le code d’invitation, et un faux code est refusé', async ({ page }) => {
  // Le premier compte existe (voir compte.setup) : à partir de là, la porte a
  // une clé. L'écran propose de créer un compte parce que la pile en a
  // configuré une (voir docker-compose.e2e.yml) - sans code configuré, il ne
  // proposerait rien du tout, ce qui n'ouvrirait qu'un refus.
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

test('un mot de passe faux ne dit pas si l’adresse existe', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse e-mail').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill('ce-n-est-pas-le-bon')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  const refusMotDePasse = await page.getByText('Adresse ou mot de passe incorrect.').textContent()

  await page.getByLabel('Adresse e-mail').fill('personne@iozycore.test')
  await page.getByLabel('Mot de passe').fill('ce-n-est-pas-le-bon')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // Le même message, mot pour mot : distinguer offrirait un test d'existence
  // de compte à qui n'en a pas.
  await expect(page.getByText('Adresse ou mot de passe incorrect.')).toHaveText(refusMotDePasse ?? '')
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toHaveCount(0)
})

test('se connecter puis se déconnecter referme vraiment', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Adresse e-mail').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible()

  // Par le CHEMIN, pas par l'URL : avatar ▸ Profil ▸ Paramètres.
  // « Se déconnecter » a quitté Profil pour Paramètres ▸ Mon compte, avec le
  // pseudo, l'adresse et l'export - un seul endroit pour « mon compte » au lieu
  // de deux moitiés.
  await page.getByRole('link', { name: new RegExp(`Mon profil — ${COMPTE.pseudo}`) }).first().click()
  await page.getByRole('link', { name: /Paramètres/ }).click()
  await expect(page.getByRole('region', { name: 'Mon compte' })).toBeVisible()
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()

  // Et la session est morte CÔTÉ SERVEUR, pas seulement effacée à l'écran :
  // revenir sur la collection ne la rouvre pas.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
})
