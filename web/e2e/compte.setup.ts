import { expect, test as setup } from '@playwright/test'
import { COMPTE, FICHIER_DE_SESSION } from './compte'

/**
 * Crée le premier compte — et rend sa session aux autres parcours.
 *
 * <h2>Pourquoi c'est un « setup » et pas un test parmi les autres</h2>
 * Tous les autres parcours commencent connecté. Les faire tous passer par
 * l'écran de connexion ajouterait dix fois le même début, et surtout dix
 * façons de le rater. Ici, la session est ouverte une fois, rangée sur le
 * disque, et rejouée par chaque test — c'est le patron standard de Playwright.
 *
 * <p>La porte elle-même reste testée, mais en anonyme et pour de vrai (voir
 * {@code porte.spec.ts}) : ce fichier n'est pas là pour la vérifier, il est là
 * pour ouvrir.
 */


setup('créer le premier compte de cette instance', async ({ page }) => {
  await page.goto('/')

  // Une instance neuve n'a personne : elle propose de créer, pas de se
  // connecter. Cette phrase-là ne peut venir que d'un appel à /api/auth/etat
  // réellement acheminé - elle vérifie donc aussi le proxy.
  await expect(page.getByText('Personne n’a encore de compte ici')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible()

  await page.getByLabel('Adresse e-mail').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByLabel('Pseudo').fill(COMPTE.pseudo)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  // Créer connecte du même geste : on arrive dans l'application, pas sur un
  // écran de connexion qui redemanderait ce qu'on vient de taper.
  await expect(page.getByRole('heading', { name: 'Ma collection' })).toBeVisible()
  await expect(page.getByText("Rien ici pour l'instant.")).toBeVisible()

  // Et l'en-tête dit au nom de qui : l'avatar porte les initiales du pseudo,
  // pas celles de l'application.
  await expect(page.getByRole('link', { name: `Mon profil — ${COMPTE.pseudo}` })).toHaveText('CE')

  await page.context().storageState({ path: FICHIER_DE_SESSION })
})
