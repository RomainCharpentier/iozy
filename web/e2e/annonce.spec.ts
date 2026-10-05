import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>Evaluate a used listing before buying.</b>
 *
 * <p>Sixth of the ten structuring journeys, and the one that has the most to
 * lose from not being played in full: it is the only screen where the
 * application tells someone whether to <b>spend money</b>. The engine has its
 * thirty-five unit tests; what they cannot say is whether what is typed
 * reaches the server, and whether what comes back is displayed.
 *
 * <p>The rule checked here, which makes all the difference between this screen
 * and a calculator: <b>the listing is compared with the collection</b>. A
 * bundle that contains already owned volumes must say so, put a number on what
 * remains useful, and correct the price beyond which it is no longer useful.
 */

test('enter a listing, and see the already owned volumes correct the verdict', async ({ page }) => {
  const titre = `Berserk ${Date.now()}`
  await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 40,
    tomesPossedes: [1, 2],
    prixNeufAuTome: 8,
  })

  // --- From Découvrir: this is where the analysis lives since it left the
  //     navigation bar (batch 137), together with a series detail page. The
  //     bar no longer names it - one destination less, not one shortcut
  //     more.
  await page.goto('/discover')
  await page.getByRole('link', { name: /Analyser une annonce/ }).click()
  await expect(page).toHaveURL(/\/purchase-analysis$/)
  await expect(page.getByRole('heading', { name: 'Analyser une annonce' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: /Analyser une annonce/ })).toHaveCount(0)
  // And the screen knows where we come from.
  await expect(page.getByRole('button', { name: 'Découvrir' })).toBeVisible()

  // --- The bundle: six volumes, two of which we already have
  // `getByRole('textbox')` and not `getByLabel`: the button "Ajouter une autre
  // série au lot", right next to it, also carries the word "Série".
  await page.getByRole('textbox', { name: 'Série' }).fill(titre)
  await page.getByRole('textbox', { name: 'Tomes' }).fill('1-6')

  // The price lives behind a collapsible, and its label SAYS what is missing
  // ("Prix, frais de port, titre… à renseigner") rather than "Détails":
  // without a price, there is nothing to evaluate, and the main button stays
  // grayed out.
  await page.getByRole('button', { name: /à renseigner/ }).click()
  await page.getByLabel('Prix demandé (€)').fill('30')

  // The button carries what it will evaluate, not a verb alone.
  await page.getByRole('button', { name: 'Évaluer ce lot' }).click()

  // --- The verdict, and what is needed to understand it
  await expect(page.getByText("Prix de l'annonce").first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Détail par série' })).toBeVisible()

  // --- What this screen knows and a calculator ignores
  //
  //     Volumes 1 and 2 are already in the collection: four useful volumes
  //     out of six, so 7.50 € per volume really gained and not 5 €.
  await expect(page.getByText('Tomes déjà possédés : 1, 2')).toBeVisible()
  await expect(page.getByText(/4 tomes utiles/)).toBeVisible()
  // "7,50 €": decimal comma and a narrow no-break space before the symbol (batch 148).
  await expect(page.getByText(/7,50\s€\/tome utile/)).toBeVisible()
})

test('a bundle with no duplicate does not talk about duplicates', async ({ page }) => {
  // The counterpart of the previous test: the warning must be INFORMATION,
  // not a permanent ornament. Always displayed, it no longer means anything.
  const titre = `Vinland Saga ${Date.now()}`
  await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 40,
    tomesPossedes: [1, 2],
    prixNeufAuTome: 8,
  })

  await page.goto('/purchase-analysis')
  await page.getByRole('textbox', { name: 'Série' }).fill(titre)
  await page.getByRole('textbox', { name: 'Tomes' }).fill('10-13')
  await page.getByRole('button', { name: /à renseigner/ }).click()
  await page.getByLabel('Prix demandé (€)').fill('30')
  await page.getByRole('button', { name: 'Évaluer ce lot' }).click()

  await expect(page.getByRole('heading', { name: 'Détail par série' })).toBeVisible()
  await expect(page.getByText(/Tomes? déjà possédés?/)).toHaveCount(0)
})
