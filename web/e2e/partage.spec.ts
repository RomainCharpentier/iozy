import { expect, test } from '@playwright/test'

/**
 * <b>Un lien qu'on envoie, et qu'on peut reprendre.</b>
 *
 * <p>C'est la seule surface de l'application dont une régression est
 * <b>irréversible</b> : ailleurs, un défaut affiche un mauvais chiffre ; ici,
 * il montre à un tiers ce qu'on avait choisi de garder — et un lien distribué
 * ne se rappelle pas.
 *
 * <p>Ce que les tests de contrat HTTP ne peuvent pas dire, et qui se vérifie
 * ici : que le lien affiché à l'écran est bien celui qui fonctionne, qu'il
 * s'ouvre <b>sans aucune session</b> (contexte de navigateur neuf, pas juste
 * un onglet privé de façade), et que « Désactiver le partage » le referme
 * pour de bon.
 */

test('générer un lien, le lire sans compte, puis le reprendre', async ({ page, browser }) => {
  const univers = `Vinyle ${Date.now()}`
  const oeuvre = 'Random Access Memories'

  // --- Une collection à partager
  await page.goto('/types/new')
  await page.getByLabel('Label').fill(univers)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page).toHaveURL(/\/types$/)

  await page.goto('/add')
  await page.getByRole('button', { name: univers }).click()
  await page.getByLabel(/Titre|Un titre/).fill(oeuvre)
  await page.getByRole('button', { name: `Ajouter « ${oeuvre} »` }).click()
  await page.getByRole('button', { name: 'Ajouter à ma collection' }).click()
  await expect(page.getByRole('heading', { name: oeuvre })).toBeVisible()

  // --- Le lien se génère depuis Profil, sa maison
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Générer un lien' }).click()

  const lien = await page.getByText(/\/public\/share\//).innerText()
  expect(lien).toContain('/public/share/')

  // --- Un visiteur SANS session : contexte neuf, aucun cookie hérité
  const visiteur = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const pageVisiteur = await visiteur.newPage()
  await pageVisiteur.goto(lien)

  await expect(pageVisiteur.getByRole('heading', { name: /Collection|Espace partagé/ }).first()).toBeVisible()
  // Deux occurrences : le titre de la tuile, et le repli affiché à la place
  // de la jaquette absente. La première suffit - c'est la présence qui est
  // en jeu, pas le nombre de fois où elle est écrite.
  await expect(pageVisiteur.getByText(oeuvre).first()).toBeVisible()
  // Ce qu'un visiteur ne doit jamais voir : la navigation privée du
  // propriétaire. La page de partage vit hors de l'application.
  await expect(pageVisiteur.getByRole('link', { name: 'Ma collection' })).toHaveCount(0)

  // --- Reprendre le lien le referme immédiatement
  await page.getByRole('button', { name: 'Désactiver le partage' }).click()
  await expect(page.getByRole('button', { name: 'Générer un lien' })).toBeVisible()

  await pageVisiteur.reload()
  await expect(pageVisiteur.getByText("Ce lien n'existe pas ou n'est plus actif.")).toBeVisible()
  await expect(pageVisiteur.getByText(oeuvre)).toHaveCount(0)

  await visiteur.close()
})
