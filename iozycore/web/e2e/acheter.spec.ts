import { expect, test } from '@playwright/test'
import { jetonCsrf } from './amorcage'

/**
 * <b>"À acheter" (lot 216): wish something, see it to buy, then "Je l'ai".</b>
 *
 * The starting state goes through the API, with a type created for the
 * occasion: the list is read from the generic works, so a type nobody
 * delivered must reach it like the others. What is checked goes through the
 * screen: the line, the gesture in place, and the copy it creates.
 */
test('a wish is on the list, and "Je l\'ai" moves it to the collection', async ({ page }) => {
  const suffixe = Date.now()
  const titre = `Envie e2e ${suffixe}`
  await page.goto('/')
  const entetes = { 'X-XSRF-TOKEN': await jetonCsrf(page) }

  const type = await page.request.post('/api/entity-types', {
    headers: entetes,
    data: { code: `ACHAT_${suffixe}`, label: `Achats ${suffixe}`, allowedExperienceTypes: [], customFieldKeys: [] },
  })
  expect(type.ok()).toBe(true)
  const { id: entityTypeId } = (await type.json()) as { id: string }

  const envie = await page.request.post('/api/wishlist', { headers: entetes, data: { entityTypeId, title: titre } })
  expect(envie.ok()).toBe(true)
  const { entityId } = (await envie.json()) as { entityId: string }

  // --- The bar leads to the page, and the page lists the wish
  await page.getByRole('navigation').getByRole('link', { name: 'À acheter' }).first().click()
  await expect(page).toHaveURL(/\/to-buy$/)
  await expect(page.getByRole('heading', { name: /^Dépensé en / })).toBeVisible()
  const jeLAi = page.getByRole('button', { name: `${titre} : je l'ai` })
  await expect(jeLAi).toBeVisible()

  // --- "Je l'ai": the line leaves at once, and the copy exists
  await jeLAi.click()
  await expect(jeLAi).toHaveCount(0)
  await expect(page.getByText(`${titre} : dans ta collection`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible()
  await expect
    .poll(async () => {
      const copies = (await (await page.request.get(`/api/ownerships?entityId=${entityId}`)).json()) as unknown[]
      return copies.length
    })
    .toBe(1)
  // The wish it closed is gone too: it no longer comes back on reload.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'À acheter', level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: `${titre} : je l'ai` })).toHaveCount(0)
})

test('the listing analysis opens beside the list, and closes back to it', async ({ page }) => {
  await page.goto('/to-buy')
  await page.getByRole('link', { name: 'Analyser une annonce' }).click()
  await expect(page).toHaveURL(/\/to-buy\/analyse$/)
  const panneau = page.getByRole('dialog', { name: 'Analyser une annonce' })
  await expect(panneau.getByRole('textbox', { name: 'Série' })).toBeVisible()

  await panneau.getByRole('button', { name: 'Fermer l’analyse' }).click()
  await expect(page).toHaveURL(/\/to-buy$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // The analysis keeps its own address.
  await page.goto('/purchase-analysis')
  await expect(page.getByRole('heading', { name: 'Analyser une annonce' })).toBeVisible()
})
