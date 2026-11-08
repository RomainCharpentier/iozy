import { expect, test } from '@playwright/test'

/**
 * <b>The glass top bar of the redesign (lot 210), for real.</b>
 *
 * The five intentions of the site, the "Chercher ou ajouter" field that
 * lands on the catalog search, and its two other ways to add. Each link is
 * the kind of thing that breaks in silence: the bar keeps drawing, a screen
 * simply stops being reachable.
 */
test('the top bar leads to each intention, and the search lands on the catalog', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })

  // --- The five intentions, Accueil lit at home
  await expect(nav.getByRole('link')).toHaveText(['Accueil', 'Sorties', 'À acheter', 'Partager', 'IozyTest'])
  await expect(nav.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'IozyTest' })).toHaveAttribute('href', '/test/')

  await nav.getByRole('link', { name: 'Sorties' }).click()
  await expect(page).toHaveURL(/\/releases$/)
  await expect(nav.getByRole('link', { name: 'Sorties' })).toHaveAttribute('aria-current', 'page')

  // --- "Partager" opens the sharing, where the share link is managed today
  await nav.getByRole('link', { name: 'Partager' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible()

  // --- The search sends its text to the catalog
  const champ = page.getByRole('searchbox', { name: 'Chercher ou ajouter' }).first()
  await champ.fill('Berserk')
  await champ.press('Enter')
  await expect(page).toHaveURL(/\/add\?q=Berserk$/)

  // --- And its menu offers the two other ways to add
  await page.getByRole('button', { name: "Autres façons d'ajouter" }).first().click()
  await expect(page.getByRole('link', { name: 'Scanner un code' })).toHaveAttribute('href', '/scan')
  await page.getByRole('link', { name: 'Depuis une photo' }).click()
  await expect(page).toHaveURL(/\/import-photo$/)
})
