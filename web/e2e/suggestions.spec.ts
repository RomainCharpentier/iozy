import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>See the almost complete series, and what it would cost to finish
 * them.</b>
 *
 * <p>Seventh of the ten structuring journeys, and the only one that crosses
 * the <b>three</b> server calculations at once: the progress (what we own),
 * the completeness (what is missing, according to the reference edition) and
 * the price (what it costs, according to the most reliable base available).
 * Each has its unit tests; their sequence had none.
 *
 * <p>The journey starts from <b>Découvrir</b> and not from the URL: the two
 * surfaces that show these suggestions read the same endpoint, and "Tout voir"
 * is the real path between them. A routing regression is invisible there
 * otherwise.
 */

test('spot an almost complete series from Découvrir, and reach its detail page', async ({ page }) => {
  const titre = `Pluto ${Date.now()}`
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 8,
    tomesPossedes: [1, 2, 3, 4, 5, 6],
    // A reference price: without it, the suggestion exists but cannot
    // announce any cost - and this is precisely half of its purpose.
    prixNeufAuTome: 9,
  })

  // --- 1. The Découvrir preview brings it up
  await page.goto('/discover')
  const opportunite = page.getByRole('button', { name: new RegExp(titre) }).first()
  await expect(opportunite).toBeVisible()

  // --- 1 bis. The discoveries by universe live here too (batch 142), on
  //     demand: with no rating given, the manga has no favorite author to
  //     offer, and it says so with that reason (batch 159). No provider was
  //     asked, so no outage is announced and nothing invites to try again.
  await expect(page.getByRole('heading', { name: 'Découvertes' })).toBeVisible()
  await page.getByRole('button', { name: 'Voir des suggestions' }).click()
  await expect(page.getByText(/^Manga : rien à proposer/)).toContainText('Aucune œuvre notée')
  await expect(page.getByText(/^Manga : la source n'a pas répondu/)).toHaveCount(0)

  // --- 2. "Tout voir" leads to the full screen
  await page.getByRole('button', { name: 'Tout voir' }).first().click()
  await expect(page).toHaveURL(/\/suggestions$/)
  await expect(page.getByRole('heading', { name: "Suggestions d'achats" })).toBeVisible()

  // --- 3. What the row announces: the edition, the gap, and the cost
  //
  //     Two volumes at 9 €: 18 €, based on the new price for lack of a
  //     market reading. The base is NAMED - "théorique" is not "marché", and
  //     the user decides knowing it.
  const ligne = page.getByRole('button', { name: new RegExp(titre) })
  await expect(ligne).toContainText('Standard')
  await expect(ligne).toContainText('6/8 tomes')
  await expect(ligne).toContainText('2 manquants')
  await expect(ligne).toContainText(/18,00\s€/)
  await expect(ligne).toContainText('théorique')

  // --- 4. And it takes us where we can act
  await ligne.click()
  await expect(page).toHaveURL(new RegExp(`/entity/${entityId}$`))
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
})

test('a complete series is not suggested', async ({ page }) => {
  // The rule that makes this screen usable: it lists ONLY what we can act
  // on. A complete series would appear there as a reminder of nothing.
  const titre = `Solanin ${Date.now()}`
  await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 2,
    tomesPossedes: [1, 2],
  })

  await page.goto('/suggestions')
  await expect(page.getByRole('heading', { name: "Suggestions d'achats" })).toBeVisible()

  await expect(page.getByRole('button', { name: new RegExp(titre) })).toHaveCount(0)
})
