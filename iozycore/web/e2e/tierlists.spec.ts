import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>Rank one's works, from the empty list to the assigned rank.</b>
 *
 * <p>The ninth of the ten structuring journeys, and the one that crosses the
 * most surfaces: a screen, a creation dialog, an add panel, a rank selector.
 * Four components each with their own tests, whose sequence had none - yet
 * this is where it breaks: a created list that does not appear, an added work
 * that stays invisible, a chosen rank that is not applied.
 */

test('create a Tier List, add a work to it, and give it a rank', async ({ page }) => {
  const titre = `Berserk ${Date.now()}`
  const nomDeLaListe = `Mes préférés ${Date.now()}`
  await serieAvecEdition(page, { titre, edition: 'Standard', totalVolumes: 3, tomePossede: 1 })

  // --- 1. Create the list
  await page.goto('/tier-lists')
  await page.getByRole('button', { name: 'Nouvelle Tier List' }).click()
  await page.getByLabel('Nom').fill(nomDeLaListe)
  await page.getByRole('button', { name: 'Manga', exact: true }).click()
  await page.getByRole('button', { name: 'Créer la Tier List' }).click()

  // Creating takes us TO the list: it is empty, and this is the moment when
  // we want to fill it.
  await expect(page).toHaveURL(/\/tier-lists\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: nomDeLaListe })).toBeVisible()

  // --- 2. Add the work to it
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  // The title appears twice on the tile (the cover fallback and the caption):
  // we target the BUTTON that contains them, not one of the two texts.
  await page.getByRole('button', { name: titre }).first().click()
  // The panel button announces HOW MANY it will add - "Ajouter (1)" - and it
  // must be targeted INSIDE the dialog: the one of the board, behind it,
  // carries the same word and stays in the page.
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter (1)' }).click()

  // Added but not yet ranked: the two states are distinct, and this is the
  // whole point of a Tier List ("in the list" is not "ranked").
  await expect(page.getByRole('button', { name: `${titre}, non classée` })).toBeVisible()

  // --- 3. Give it a rank
  await page.getByRole('button', { name: `${titre}, non classée` }).click()
  await page.getByRole('button', { name: 'S', exact: true }).click()

  await expect(page.getByRole('button', { name: `${titre}, rang S` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${titre}, non classée` })).toHaveCount(0)

  // --- 4. The back button names where we come from (UX-8)
  await expect(page.getByRole('button', { name: 'Tier Lists' })).toBeVisible()
})
