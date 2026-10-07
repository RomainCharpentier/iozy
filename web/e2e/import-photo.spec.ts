import { expect, test } from '@playwright/test'

/**
 * Import from a photo of the shelf, on the throwaway stack - so WITHOUT a
 * vision engine (no key, on purpose). What this journey checks: the entry
 * point from the Catalogue, sending a photo all the way to the API, and an
 * honest answer when nothing can be read - a dedicated message, not a
 * failure, and nothing to add. Reading with the real engine is checked by
 * hand, with a key (see DESIGN_MIGRATION, batch 147).
 */
test('import from a photo: the entry point, then an honest reading without an engine', async ({ page }) => {
  await page.goto('/add')
  await page.getByRole('link', { name: 'Importer depuis une photo' }).click()
  await expect(page).toHaveURL(/\/import-photo$/)
  await expect(page.getByRole('heading', { name: 'Importer depuis une photo' })).toBeVisible()
  await expect(page.getByText("Les photos sont envoyées à un service d'analyse d'images", { exact: false })).toBeVisible()

  // A minimal JPEG: enough to pass the server door, nothing to read inside.
  const octets = Buffer.alloc(64)
  octets[0] = 0xff
  octets[1] = 0xd8
  octets[2] = 0xff
  octets[3] = 0xe0
  await page.locator('input[type=file]').setInputFiles({ name: 'etagere.jpg', mimeType: 'image/jpeg', buffer: octets })

  await expect(page.getByText("L'analyse des photos n'est pas configurée sur cette instance.")).toBeVisible()
  await expect(page.getByText('Rien n’a pu être lu', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ajouter \d+ tome/ })).toHaveCount(0)
})

/**
 * The one-by-one check writes each volume as it is confirmed, so one can leave at
 * any point. The reading is faked (the stack has no vision engine), the rest is real:
 * the list of editions (no source key, so the single default edition), the write,
 * and the collection read back from the API. What the faked reading hides - a photo read
 * again showing the confirmed volumes as owned - is the server's rule since batch 147.
 */
test('import from a photo: a confirmed volume is in the collection at once, even if one leaves', async ({ page }) => {
  const titre = `Berserk ${Date.now()}`
  const lu = (numero: number) => ({
    item: {
      seriesTitle: titre,
      seriesTitleAsRead: titre.toUpperCase(),
      volumeNumber: numero,
      editionHint: null,
      hasExactIdentifier: false,
      confidence: 'HIGH',
      sources: ['VISION'],
      sourceLabels: ['photos'],
      evidence: [`Chiffre ${numero} sur la tranche`],
      sourceImages: [0],
      boxes: [],
      catalogStatus: 'NOT_IN_CATALOG',
      entityId: null,
      editionOptions: [],
      preselected: false,
      readyForAnalysis: true,
    },
    alreadyOwned: false,
    proposal: null,
    proposalByTitle: false,
  })
  await page.route('**/api/shelf-import/analyze-photos', (route) =>
    route.fulfill({
      json: {
        visionStatus: 'OK',
        items: [lu(1), lu(2)],
        unidentifiedCount: 0,
        notInCatalogCount: 1,
        analyzedImageCount: 1,
        requestedImageCount: 1,
        lookupsSkipped: 0,
      },
    }),
  )

  await page.goto('/import-photo')
  const octets = Buffer.alloc(64)
  octets.set([0xff, 0xd8, 0xff, 0xe0])
  await page.locator('input[type=file]').setInputFiles({ name: 'etagere.jpg', mimeType: 'image/jpeg', buffer: octets })

  await expect(page.getByText('Extrait 1 sur 2', { exact: false })).toBeVisible()
  // No source knows an edition of this invented series: the single choice is picked.
  await expect(page.getByRole('combobox', { name: 'Édition' })).toHaveValue('Édition standard')

  const ecriture = page.waitForResponse((r) => r.url().endsWith('/api/shelf-import/apply') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'C’est bien ça' }).click()
  const rapport = await (await ecriture).json()
  expect(rapport.items).toHaveLength(1)
  expect(rapport.items[0]).toMatchObject({ seriesTitle: titre, volumeNumber: 1, edition: 'Édition standard', outcome: 'ADDED' })

  // On the second excerpt, one stops here: leaving the page loses nothing of the first.
  await expect(page.getByText('Extrait 2 sur 2', { exact: false })).toBeVisible()
  await page.goto('/add')

  const possessions = await (await page.request.get(`http://localhost:5174/api/ownerships?entityId=${rapport.items[0].entityId}`)).json()
  expect(possessions).toHaveLength(1)
})
