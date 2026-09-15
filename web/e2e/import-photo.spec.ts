import { expect, test } from '@playwright/test'

/**
 * Importer depuis une photo de l'étagère, sur la pile jetable - donc SANS
 * moteur de vision (aucune clé, exprès). Ce que ce parcours vérifie :
 * la porte depuis le Catalogue, l'envoi d'une photo jusqu'à l'API, et une
 * réponse honnête quand rien ne peut être lu - un message dédié, pas une
 * panne, et rien à ajouter. La lecture par le vrai moteur se vérifie à la
 * main, avec une clé (voir DESIGN_MIGRATION, lot 147).
 */
test('importer depuis une photo : la porte, puis une lecture honnête sans moteur', async ({ page }) => {
  await page.goto('/add')
  await page.getByRole('link', { name: 'Importer depuis une photo' }).click()
  await expect(page).toHaveURL(/\/import-photo$/)
  await expect(page.getByRole('heading', { name: 'Importer depuis une photo' })).toBeVisible()
  await expect(page.getByText("Les photos sont envoyées à un service d'analyse d'images", { exact: false })).toBeVisible()

  // Un JPEG minimal : assez pour passer la porte du serveur, rien à lire dedans.
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
