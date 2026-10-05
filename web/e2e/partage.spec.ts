import { expect, test } from '@playwright/test'

/**
 * <b>A link that we send, and that we can take back.</b>
 *
 * <p>This is the only surface of the application whose regression is
 * <b>irreversible</b>: elsewhere, a defect shows a wrong number; here, it
 * shows a third party what we had chosen to keep — and a distributed link
 * cannot be recalled.
 *
 * <p>What the HTTP contract tests cannot say, and what is checked here: that
 * the link displayed on the screen is the one that works, that it opens
 * <b>without any session</b> (a new browser context, not just a private tab
 * for show), and that "Désactiver le partage" closes it for good.
 */

test('generate a link, read it without an account, then take it back', async ({ page, browser }) => {
  const univers = `Vinyle ${Date.now()}`
  const oeuvre = 'Random Access Memories'

  // --- A collection to share
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

  // --- The link is generated from Profil, its home
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Générer un lien' }).click()

  const lien = await page.getByText(/\/public\/share\//).innerText()
  expect(lien).toContain('/public/share/')

  // --- A visitor WITHOUT a session: new context, no inherited cookie
  const visiteur = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const pageVisiteur = await visiteur.newPage()
  await pageVisiteur.goto(lien)

  await expect(pageVisiteur.getByRole('heading', { name: /Collection|Espace partagé/ }).first()).toBeVisible()
  // Two occurrences: the title of the tile, and the fallback displayed in
  // place of the missing cover. The first one is enough - it is the presence
  // that is at stake, not the number of times it is written.
  await expect(pageVisiteur.getByText(oeuvre).first()).toBeVisible()
  // What a visitor must never see: the owner's private navigation. The share
  // page lives outside the application.
  await expect(pageVisiteur.getByRole('link', { name: 'Ma collection' })).toHaveCount(0)

  // --- Taking the link back closes it immediately
  await page.getByRole('button', { name: 'Désactiver le partage' }).click()
  await expect(page.getByRole('button', { name: 'Générer un lien' })).toBeVisible()

  await pageVisiteur.reload()
  await expect(pageVisiteur.getByText("Ce lien n'existe pas ou n'est plus actif.")).toBeVisible()
  await expect(pageVisiteur.getByText(oeuvre)).toHaveCount(0)

  await visiteur.close()
})
