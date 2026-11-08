import { expect, test } from '@playwright/test'
import { serieSansReference } from './amorcage'

/**
 * <b>Fill in the total of an edition — the number that makes all the "X / Y"
 * possible.</b>
 *
 * <p>Eighth of the ten structuring journeys, and the only one whose effect is
 * seen <b>elsewhere</b> than where we act: we type one number on an entity
 * page, and the progress of the whole application becomes computable. As
 * long as the total is unknown, the app counts what it has and says "total
 * inconnu" — no "2/?", which would read as missing data while the numerator
 * is perfectly known.
 *
 * <p>Since lot 213 the total is typed in place, under the count (PUT
 * /manga/series/{id}/total): the page then says where it comes from ("saisi
 * par toi"), and it can be cleared. The publisher still goes through the
 * single "Éditer" of the side panel.
 *
 * <p>What this journey checks and no unit test can: that the number really
 * lands on the right edition, and that the <b>caches</b> that carry the
 * progress are invalidated. A successful write followed by a screen that
 * still shows the previous state breaks no rule — it is exactly the defect
 * that survives a green suite.
 */

test('type the total of an edition, see "X / Y" appear, then clear it', async ({ page }) => {
  const titre = `Monster ${Date.now()}`
  const { entityId } = await serieSansReference(page, {
    titre,
    edition: 'Standard',
    tomesPossedes: [1, 2],
  })

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // --- Before: what we own, and the admission that the rest is unknown
  await expect(page.getByText('total inconnu')).toBeVisible()
  await expect(page.getByText(/\d+ \/ \d+/)).toHaveCount(0)

  // --- The total, typed in place
  await page.getByRole('button', { name: 'Saisir le total' }).click()
  await page.getByLabel('Total de l’édition').fill('18')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()

  // --- After: the progress exists, on the same screen, without a reload, and says its source
  await expect(page.getByText('2 / 18')).toBeVisible()
  await expect(page.getByText('Il t’en manque 16')).toBeVisible()
  await expect(page.getByText('Total saisi par toi')).toBeVisible()

  // --- The publisher, through the single "Éditer" of the side panel
  await page.getByRole('button', { name: 'Notes, tags et outils' }).click()
  await page.getByRole('button', { name: 'Éditer', exact: true }).click()
  await page.getByPlaceholder('Éditeur (ex: Kana)').fill('Kana')
  await page.getByRole('button', { name: 'Enregistrer la fiche' }).click()
  await expect(page.getByText('Kana · 18 tomes')).toBeVisible()
  await page.getByRole('button', { name: 'Terminer' }).click()
  await page.getByRole('button', { name: 'Fermer le volet' }).click()
  // One edition is a word over the title, with its publisher.
  await expect(page.getByText(/Standard · Kana/)).toBeVisible()

  // --- And elsewhere: Ma collection knows it too
  //
  //     This is the real stake of the journey. The progress comes from the
  //     server in a single call for the whole collection; if its cache is not
  //     invalidated, this screen shows 2/18 while the other one still counts
  //     volumes with no total.
  await page.goto('/')
  await expect(page.getByRole('button', { name: new RegExp(`${titre}.*2/18 tomes`) })).toBeVisible()

  // --- Cleared: the total is unknown again, and nothing is guessed in its place
  await page.goto(`/entity/${entityId}`)
  await page.getByRole('button', { name: 'Effacer le total' }).click()
  await expect(page.getByText('total inconnu')).toBeVisible()
  await expect(page.getByText('2 / 18')).toHaveCount(0)
})
