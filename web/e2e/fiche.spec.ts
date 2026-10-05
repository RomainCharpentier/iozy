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

  // --- "Je l'ai": one click, nothing to fill in.
  //
  //     Two gestures lead to the same place, and this test was used to find
  //     out which one belongs to whom. With the MOUSE, hovering the tile
  //     shows an overlay with two buttons ("Je l'ai" / "Je le veux") that
  //     fully covers the tile: clicking the tile itself is then impossible,
  //     the overlay intercepts. With a FINGER, there is no hover: the overlay
  //     never shows and the tile receives the gesture. Both call the same
  //     add, no path is missing.
  //     The hover targets the WHOLE TILE (the container), not the button
  //     below: hovering the tile itself is refused for the same reason as a
  //     click - as soon as the overlay appears, it receives the pointer. The
  //     container, on the other hand, contains it.
  await page.getByRole('button', { name: 'Tome 2, manquant' }).locator('..').hover()
  await page.getByTitle("J'ai le tome 2").click()

  await expect(page.getByRole('button', { name: 'Tome 2, possédé' })).toBeVisible()
  // The progress followed - this is the link that breaks silently when a cache
  // invalidation is missing: the volume changes state, the counter does not.
  await expect(page.getByText('2/6')).toBeVisible()

  // --- And Ma collection knows it too, without a manual reload
  await page.goto('/')
  await expect(page.getByRole('button', { name: new RegExp(`${titre}.*2/6 tomes`) })).toBeVisible()
})
