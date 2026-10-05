import { expect, test } from '@playwright/test'

/**
 * <b>From the click to the database: create a universe, add a work to it, find it again.</b>
 *
 * <p>This is the founding journey — without it, there is no collection. And
 * it is the one that no unit test can cover: each of the four screens crossed
 * is fine on its own, what breaks here is the <b>passage</b> from one to the
 * other — a form wired to the wrong route, a cache that we forget to
 * invalidate, and the next screen stays on the previous state without
 * anything signaling it.
 *
 * <h2>Why a type created for the occasion</h2>
 * The three delivered universes (manga, video game, board game) require a
 * match at an external provider. The test stack deliberately has NO API key:
 * a test that depends on Jikan fails the day Jikan coughs, for a reason that
 * has nothing to do with the application. A hand-made type has no provider,
 * and therefore opens free entry - which also exercises the type editor.
 *
 * <h2>A single test, and it is deliberate</h2>
 * Splitting "add" and "do not duplicate" into two tests would require the
 * second one to find what the first one created - yet Playwright restarts its
 * worker after a failure, and the module constants are then recomputed. The
 * second test was looking for a universe with a slightly different name from
 * the one created by the first (observed). A journey that reads from one end
 * to the other does not have this problem.
 */

test('create a universe, add a work to it, and find it again rather than duplicate it', async ({ page }) => {
  // One name per run: two launches must not get in each other's way.
  const univers = `Vinyle ${Date.now()}`
  const oeuvre = 'Discovery'

  // --- 1. A universe of one's own (Paramètres ▸ Administration ▸ Types)
  await page.goto('/types/new')
  await page.getByLabel('Label').fill(univers)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()

  await expect(page).toHaveURL(/\/types$/)
  await expect(page.getByText(univers)).toBeVisible()

  // --- 2. Add it from Rechercher
  await page.goto('/add')

  // The three ways to add to one's collection are gathered here: type a
  // title, scan, import. The BGG import lived under Administration until
  // 2026-08-29 - it never had anything administrative about it.
  await expect(page.getByRole('link', { name: 'Scanner' })).toHaveAttribute('href', '/scan')
  await expect(page.getByRole('link', { name: 'Importer depuis BGG' })).toHaveAttribute('href', '/import-bgg')

  await page.getByRole('button', { name: univers }).click()
  await page.getByLabel(/Titre|Un titre/).fill(oeuvre)

  // On a type with no provider, this button is the ONLY way to add.
  await page.getByRole('button', { name: `Ajouter « ${oeuvre} »` }).click()

  // --- 3. The preview says what it is: a work not yet owned
  await expect(page.getByText("Cette œuvre n'est pas encore dans ta collection.")).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter à ma collection' }).click()

  // --- 4. We arrive on ITS detail page, not on a generic page
  await expect(page).toHaveURL(/\/entity\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: oeuvre })).toBeVisible()

  // --- 5. Ma collection shows it, with its rail and its counters
  //
  //     The count read here is that of the RAIL of this universe, not the
  //     total of the collection: this test shares its stack with the other
  //     journeys, which sow their own series in it. The first version stated
  //     "1 titre suivi" and held only as long as this file ran first - it
  //     fell the day a journey with an alphabetically earlier name arrived. A
  //     test whose truth depends on the order of the files does not check
  //     what it thinks it checks.
  //     And since the "Suivre" batch (e4dd418), the count of the "Tout" view
  //     says "N titres" plainly - "suivis" became a separate filter.
  await page.goto('/')
  await expect(page.getByText(/\d+ titres?( ·|$)/)).toBeVisible()
  await expect(page.getByRole('heading', { name: univers })).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(`^${univers} 1 Tout voir$`) })).toBeVisible()
  // The tile carries the title AND its state: "Possédé" rather than a count
  // of volumes, because for a type with no notion of volume, the work IS the
  // collectible object.
  await expect(page.getByRole('button', { name: `${oeuvre} Possédé` })).toBeVisible()

  // --- 6. Searching for it again FINDS it, instead of offering a duplicate
  await page.goto('/add')
  await page.getByRole('button', { name: univers }).click()
  await page.getByLabel(/Titre|Un titre/).fill(oeuvre)

  const dejaLa = page.getByText('Déjà dans IozyCore')
  const ajouterQuandMeme = page.getByRole('button', { name: `Ajouter « ${oeuvre} »` })
  await expect(dejaLa).toBeVisible()

  // The add button stays there - and this is intended: on a type with no
  // provider, it is the only way, and two works can have similar titles. What
  // protects from the duplicate is the ORDER: what we already own is shown
  // BEFORE offering to create. The first draft of this test claimed the
  // opposite (button absent) and it was wrong.
  await expect(ajouterQuandMeme).toBeVisible()
  const positionDeja = (await dejaLa.boundingBox())?.y ?? 0
  const positionBouton = (await ajouterQuandMeme.boundingBox())?.y ?? 0
  expect(positionDeja).toBeLessThan(positionBouton)
})
