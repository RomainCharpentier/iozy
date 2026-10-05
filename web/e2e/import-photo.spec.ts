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
