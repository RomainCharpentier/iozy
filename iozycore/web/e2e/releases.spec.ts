import { expect, test } from '@playwright/test'

/**
 * <b>Date a work on its detail page, and find it again in Sorties and in
 * the agenda subscription.</b>
 *
 * <p>The calendar has two data inputs: the sources of the universes (Google
 * Books, IGDB - which a throwaway stack without a key cannot exercise) and the
 * date entered on a detail page, for any category. This second path is the one
 * that this journey crosses from end to end: the detail page writes, the
 * calendar reads, Découvrir announces it - three screens, a single piece of
 * data. A field wired to the wrong key or a cache that we forget to invalidate
 * breaks no rule: the date would simply stay invisible.
 */

const AUJOURDHUI = new Date()
/** In twenty days: far enough to be "upcoming", close enough to fit in the Découvrir preview. */
const SORTIE = new Date(AUJOURDHUI.getFullYear(), AUJOURDHUI.getMonth(), AUJOURDHUI.getDate() + 20)

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function libelle(options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options }).format(
    new Date(Date.UTC(SORTIE.getFullYear(), SORTIE.getMonth(), SORTIE.getDate())),
  )
}

test('date a work on its detail page, then find it again in Sorties, in the agenda feed and on Découvrir', async ({ page, playwright }) => {
  const univers = `Vinyle ${Date.now()}`
  const oeuvre = `Random Access Memories ${Date.now()}`

  // --- 1. A universe with no date source: only the detail page can date
  await page.goto('/types/new')
  await page.getByLabel('Label').fill(univers)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page).toHaveURL(/\/types$/)

  await page.goto('/add')
  await page.getByRole('button', { name: univers }).click()
  await page.getByLabel(/Titre|Un titre/).fill(oeuvre)
  await page.getByRole('button', { name: `Ajouter « ${oeuvre} »` }).click()
  await page.getByRole('button', { name: 'Ajouter à ma collection' }).click()
  await expect(page).toHaveURL(/\/entity\/[0-9a-f-]{36}$/)

  //     The work is only owned, not followed: owning is enough to put it in the calendar.

  // --- 2. The date is entered with the rest of the detail page, in a single "Éditer"
  //     (in the side panel since lot 213)
  await page.getByRole('button', { name: 'Notes, tags et outils' }).click()
  await page.getByRole('button', { name: 'Éditer', exact: true }).click()
  await page.getByLabel('Date de sortie').fill(iso(SORTIE))
  await page.getByRole('button', { name: 'Enregistrer la fiche' }).click()
  //     Saving does not close the Éditer mode: the field shows the ISO format
  //     as long as we are in it. Once the save has gone through, "Terminer"
  //     gives back the reading view - this is where the date is read again.
  await expect(page.getByRole('button', { name: 'Enregistrer la fiche' })).toBeDisabled()
  await page.getByRole('button', { name: 'Terminer', exact: true }).click()

  //     And is read again in French, in the same place, without a reload.
  const dateLisible = libelle({ day: 'numeric', month: 'long', year: 'numeric' })
  await expect(page.getByText(dateLisible)).toBeVisible()

  // --- 3. Sorties counts down to it: the only release of the year is the next one
  await page.goto('/releases')
  //     Other specs may date works of their own universes on the same account: the
  //     universe made here gets its chip (filters come from the data), and keeps only this work.
  await expect(page.getByRole('heading', { level: 2, name: 'À venir' })).toBeVisible()
  const filtres = page.getByRole('group', { name: 'Filtrer par catégorie' })
  if (await filtres.isVisible()) await filtres.getByRole('button', { name: new RegExp(univers) }).click()
  await expect(page.getByRole('heading', { level: 2, name: oeuvre })).toBeVisible()
  await expect(page.getByText('Dans 20 jours')).toBeVisible()
  //     Owned: nothing to pre-order, the hero leads to its detail page.
  await expect(page.getByRole('button', { name: "Je l'ai précommandé" })).toHaveCount(0)
  await expect(page.locator('section', { has: page.getByRole('heading', { level: 2, name: oeuvre }) })).toContainText(univers)

  // --- 3b. The agenda subscription: a secret link, read with no session, cut by "Nouveau lien"
  await page.getByRole('button', { name: "S'abonner dans mon agenda" }).click()
  const champ = page.getByRole('textbox', { name: 'Lien https://' })
  await expect(champ).toHaveValue(/\/api\/public\/calendar\/[A-Za-z0-9_-]{43}\.ics$/)
  const lien = await champ.inputValue()
  await expect(page.getByRole('textbox', { name: 'Lien webcal://' })).toHaveValue(lien.replace(/^https?:\/\//, 'webcal://'))

  //     A fresh context: no cookie, as an agenda app reads it.
  const agenda = await playwright.request.newContext()
  const flux = await agenda.get(lien)
  expect(flux.status()).toBe(200)
  expect(flux.headers()['content-type']).toContain('text/calendar')
  //     Long lines are folded (RFC 5545): unfold before reading the title.
  expect((await flux.text()).replace(/\r\n[ \t]/g, '')).toContain(`SUMMARY:${oeuvre}`)

  await page.getByRole('button', { name: 'Nouveau lien' }).click()
  await page.getByRole('button', { name: "Oui, couper l'ancien lien" }).click()
  await expect(champ).not.toHaveValue(lien)
  expect((await agenda.get(lien)).status()).toBe(404)
  await agenda.dispose()

  // --- 4. Découvrir announces it among the next releases, and "Tout voir" brings back here
  await page.goto('/discover')
  //     On mobile the panel is a sub-tab; on desktop (the test browser) it is
  //     already expanded, and the tab does not exist on the screen.
  const onglet = page.getByRole('tab', { name: 'Sorties' })
  if (await onglet.isVisible()) await onglet.click()
  await expect(page.getByRole('link', { name: new RegExp(oeuvre) })).toBeVisible()

  //     The line says the sources were never read (a fresh instance), and refreshing on demand
  //     leaves a date behind. The test stack has no provider and no manga: the pass is instant and empty.
  await expect(page.getByText("Les sources de sorties n'ont pas encore été consultées.")).toBeVisible()
  await page.getByRole('button', { name: 'Mettre à jour maintenant' }).click()
  await expect(page.getByText("Sorties mises à jour à l'instant")).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(oeuvre) })).toBeVisible()

  //     Three panels of Découvrir say "Tout voir": the right one sits under the heading of this panel.
  const releasesPanel = page.locator('section', { has: page.getByRole('heading', { name: 'Dernières sorties' }) })
  await releasesPanel.getByRole('link', { name: 'Tout voir' }).click()
  await expect(page).toHaveURL(/\/releases/)
})
