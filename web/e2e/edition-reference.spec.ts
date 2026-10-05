import { expect, test } from '@playwright/test'
import { serieSansReference } from './amorcage'

/**
 * <b>Fill in the reference edition — the one that makes all the "X/Y"
 * possible.</b>
 *
 * <p>Eighth of the ten structuring journeys, and the only one whose effect is
 * seen <b>elsewhere</b> than where we act: we fill in two fields on a detail
 * page, and the progress of the whole application becomes computable. As long
 * as the number of volumes is unknown, the app counts what it has ("2 tomes")
 * without ever inventing a denominator — no "2/?", which would read as
 * missing data while the numerator is perfectly known.
 *
 * <p>What this journey checks and no unit test can: that the form really
 * writes into the right edition, and that the <b>caches</b> that carry the
 * progress are invalidated. A successful write followed by a screen that
 * still shows the previous state breaks no rule — it is exactly the defect
 * that survives a green suite.
 */

test('fill in the number of volumes of an edition, and see "X/Y" appear', async ({ page }) => {
  const titre = `Monster ${Date.now()}`
  const { entityId } = await serieSansReference(page, {
    titre,
    edition: 'Standard',
    tomesPossedes: [1, 2],
  })

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // --- Before: what we own, and the admission that the rest is unknown
  await expect(page.getByText('2 tomes', { exact: true })).toBeVisible()
  await expect(page.getByText('Détails à renseigner')).toBeVisible()

  // --- Fill in the reference record
  //
  //     A single "Éditer" for the whole page (Batch 129-130): the rows of the
  //     inspector become fields, in the same place, and a single bar saves
  //     them.
  await page.getByRole('button', { name: 'Éditer', exact: true }).click()
  await page.getByPlaceholder('Nb de tomes').fill('18')
  await page.getByPlaceholder('Éditeur (ex: Kana)').fill('Kana')
  await page.getByRole('button', { name: 'Enregistrer la fiche' }).click()

  // --- After: the progress exists, on the same screen, without a reload
  await expect(page.getByText('2/18')).toBeVisible()
  await expect(page.getByText('Kana · 18 tomes')).toBeVisible()
  // And as a screen reader hears it - "2/18" is not enough.
  await expect(page.getByText('2 tomes possédés sur 18')).toBeAttached()

  // --- And elsewhere: Ma collection knows it too
  //
  //     This is the real stake of the journey. The progress comes from the
  //     server in a single call for the whole collection; if its cache is not
  //     invalidated, this screen shows 2/18 while the other one still counts
  //     volumes with no total.
  await page.goto('/')
  await expect(page.getByRole('button', { name: new RegExp(`${titre}.*2/18 tomes`) })).toBeVisible()
})
