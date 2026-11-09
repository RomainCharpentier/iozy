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
 *
 * <p>Lot 217: the link lives on "Partager" (/share), a pinned work leads the
 * public page, and the gift list is a second link that shows the wishes
 * only. Its expiry after 30 days is checked by the backend
 * (SharePageHttpContractTest): the e2e stack has no clock to move.
 */

test('make a link, pin a work, send a gift list, then take the link back', async ({ page, browser }) => {
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

  // --- The link is made on "Partager", its own page since lot 217
  await page.goto('/share')
  await page.getByRole('button', { name: 'Activer ma page' }).click()

  const lien = await page.getByText(/\/public\/share\//).innerText()
  expect(lien).toContain('/public/share/')

  // --- The work becomes one of "Mes incontournables"
  await page.getByRole('button', { name: `Épingler ${oeuvre}` }).click()
  await expect(page.getByRole('button', { name: `Retirer ${oeuvre} de mes incontournables` })).toBeVisible()

  // --- A visitor WITHOUT a session: new context, no inherited cookie
  const visiteur = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const pageVisiteur = await visiteur.newPage()
  await pageVisiteur.goto(lien)

  await expect(pageVisiteur.getByRole('heading', { name: /Collection|Espace partagé/ }).first()).toBeVisible()
  await expect(pageVisiteur.getByRole('heading', { name: 'Mes incontournables' })).toBeVisible()
  // Several occurrences: the pinned work, the tile, the fallback in place of
  // the missing cover. The presence is what is at stake.
  await expect(pageVisiteur.getByText(oeuvre).first()).toBeVisible()
  // What a visitor must never see: the owner's private navigation. The share
  // page lives outside the application.
  await expect(pageVisiteur.getByRole('link', { name: 'Ma collection' })).toHaveCount(0)

  // --- The gift list: a second link, the wishes only
  await page.getByRole('button', { name: 'Créer ma liste de cadeaux' }).click()
  const listeDeCadeaux = page.getByRole('region', { name: 'Liste de cadeaux' })
  await expect(listeDeCadeaux.getByText(/^Expire le /)).toBeVisible()
  const lienCadeaux = await listeDeCadeaux.getByText(/\/public\/share\//).innerText()
  expect(lienCadeaux).not.toBe(lien)

  const pageCadeaux = await visiteur.newPage()
  await pageCadeaux.goto(lienCadeaux)
  await expect(pageCadeaux.getByRole('heading', { name: 'Liste de cadeaux' })).toBeVisible()
  await expect(pageCadeaux.getByText(/^Valable jusqu’au /)).toBeVisible()
  // The collection does not leave through a gift list.
  await expect(pageCadeaux.getByText(oeuvre)).toHaveCount(0)

  // --- Taking the link back asks twice, then closes it immediately
  await page.getByRole('button', { name: 'Désactiver le partage' }).click()
  await page.getByRole('button', { name: 'Oui, désactiver' }).click()
  await expect(page.getByRole('button', { name: 'Activer ma page' })).toBeVisible()

  await pageVisiteur.reload()
  await expect(pageVisiteur.getByText("Ce lien n'existe pas ou n'est plus actif.")).toBeVisible()
  await expect(pageVisiteur.getByText(oeuvre)).toHaveCount(0)

  // The gift list is a separate link: it keeps working.
  await pageCadeaux.reload()
  await expect(pageCadeaux.getByRole('heading', { name: 'Liste de cadeaux' })).toBeVisible()

  await visiteur.close()
})
