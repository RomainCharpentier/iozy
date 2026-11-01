import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>"X/Y tomes", and the gesture that makes it move.</b>
 *
 * <p>Two of the ten structuring journeys, and the most frequent of all:
 * reading where a series stands, and ticking the volume we just bought. What
 * is checked here and nowhere else is the <b>complete chain</b> - the grid
 * announces a missing volume, a click adds it, the server writes, the
 * progress follows. Each of these links has its unit test; their sequence had
 * none.
 *
 * <p>The starting state is set by the API (see `amorcage.ts`): a manga cannot
 * be added by hand without a metadata provider, and it is precisely on a
 * manga that "X/Y" exists.
 */

test('read the progress of an edition, then tick a missing volume', async ({ page }) => {
  const titre = `Vagabond ${Date.now()}`
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 6,
    tomePossede: 1,
  })

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // --- The progress, as the edition card announces it
  await expect(page.getByText('1/6')).toBeVisible()
  // And as a screen reader hears it: "3/27" is not enough.
  await expect(page.getByText('1 tome possédé sur 6')).toBeAttached()
  // The total comes from the edition record, never guessed.
  await expect(page.getByText('6 tomes')).toBeVisible()

  // --- The grid says what is missing
  await expect(page.getByRole('button', { name: 'Tome 1, possédé' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tome 2, manquant' })).toBeVisible()

  // --- "Je l'ai": pick the spine, then the gesture in the bar, nothing to fill in.
  //
  //     A click on a spine PICKS it (a toggle, `aria-pressed`), and the bar
  //     above the shelves carries the gestures for what is picked. The mouse
  //     never chases a card: the first shelf put the pill under the pointer,
  //     and the owner found it "pas pratique" (2026-11-01). Same gesture with
  //     a finger or the keyboard.
  await page.getByRole('button', { name: 'Tome 2, manquant' }).click()
  await page.getByRole('button', { name: "J'ai le tome 2" }).click()

  await expect(page.getByRole('button', { name: 'Tome 2, possédé' })).toBeVisible()
  // The progress followed - this is the link that breaks silently when a cache
  // invalidation is missing: the volume changes state, the counter does not.
  await expect(page.getByText('2/6')).toBeVisible()

  // --- And Ma collection knows it too, without a manual reload
  await page.goto('/')
  await expect(page.getByRole('button', { name: new RegExp(`${titre}.*2/6 tomes`) })).toBeVisible()
})
