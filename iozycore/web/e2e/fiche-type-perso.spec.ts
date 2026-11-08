import { expect, test } from '@playwright/test'
import { jetonCsrf } from './amorcage'

/**
 * <b>A custom type gets the same entity page as a manga, in its own shape.</b>
 *
 * <p>Lot 213 made one page for every category: nothing in it asks for a type
 * code. A type created for the test, with no shape declared, must show its
 * work with its whole cover - a wide cover stays wide, never cropped into the
 * portrait of a pocket volume - and the same count and gestures.
 *
 * <p>The cover is an inline SVG three times wider than tall: no network, no
 * provider, and a proportion no shipped shape has.
 */

const COUVERTURE_LARGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><rect width="300" height="100" fill="#3a6"/></svg>',
  )

test('a custom type shows its work with the whole cover, and the same gestures', async ({ page }) => {
  const suffixe = Date.now()
  const titre = `Affiche ${suffixe}`
  // A page first: the session hands out its anti-CSRF cookie with it.
  await page.goto('/')
  const entetes = { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': await jetonCsrf(page) }

  const type = await page.request.post('/api/entity-types', {
    headers: entetes,
    data: { code: `AFFICHE_${suffixe}`, label: `Affiches ${suffixe}`, allowedExperienceTypes: [], customFieldKeys: [] },
  })
  expect(type.ok()).toBeTruthy()
  const { id: entityTypeId } = (await type.json()) as { id: string }

  const ajout = await page.request.post('/api/entities/quick-add', {
    headers: entetes,
    data: { entityTypeId, title: titre, condition: 'NEW', attributes: { coverImageUrl: COUVERTURE_LARGE } },
  })
  expect(ajout.ok()).toBeTruthy()
  const { entityId } = (await ajout.json()) as { entityId: string }

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
  // The same count as any work: one owned piece out of one.
  await expect(page.getByText('1 / 1')).toBeVisible()

  // --- The element is the work itself, in the proportions of its cover (3 to 1).
  const element = page.getByRole('button', { name: titre, exact: true })
  await expect(element).toBeVisible()
  const image = element.locator('img')
  await expect(image).toBeVisible()
  const boite = await image.boundingBox()
  expect(boite).not.toBeNull()
  expect(boite!.width / boite!.height).toBeCloseTo(3, 1)

  // --- And the same two-step removal as a volume
  await element.click()
  await page.getByRole('button', { name: `Retirer ${titre}` }).click()
  await expect(page.getByText('0 / 1')).toBeVisible()
  await expect(page.getByRole('button', { name: `${titre} : je l'ai` })).toBeVisible()
})
