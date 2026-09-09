import { expect, test } from '@playwright/test'

/**
 * <b>Dater une œuvre sur sa fiche, et la retrouver au calendrier des
 * sorties.</b>
 *
 * <p>Le calendrier a deux entrées de données : les sources des univers
 * (Google Books, IGDB - qu'une pile jetable sans clé ne peut pas exercer) et
 * la date saisie sur une fiche, pour n'importe quelle catégorie. C'est ce
 * second chemin que ce parcours traverse de bout en bout : la fiche écrit,
 * le calendrier lit, Découvrir l'annonce - trois écrans, une seule donnée.
 * Un champ branché sur la mauvaise clé ou un cache qu'on oublie d'invalider
 * ne casse aucune règle : la date resterait simplement invisible.
 */

const AUJOURDHUI = new Date()
/** Dans vingt jours : assez loin pour être « à venir », assez près pour tenir dans l'aperçu de Découvrir. */
const SORTIE = new Date(AUJOURDHUI.getFullYear(), AUJOURDHUI.getMonth(), AUJOURDHUI.getDate() + 20)

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function libelle(options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options }).format(
    new Date(Date.UTC(SORTIE.getFullYear(), SORTIE.getMonth(), SORTIE.getDate())),
  )
}

test('dater une œuvre sur sa fiche, puis la retrouver au calendrier et sur Découvrir', async ({ page }) => {
  const univers = `Vinyle ${Date.now()}`
  const oeuvre = `Random Access Memories ${Date.now()}`

  // --- 1. Un univers sans source de dates : seule la fiche peut dater
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

  // --- 2. La date se saisit avec le reste de la fiche, en un seul « Éditer »
  await page.getByRole('button', { name: 'Éditer', exact: true }).click()
  await page.getByLabel('Date de sortie').fill(iso(SORTIE))
  await page.getByRole('button', { name: 'Enregistrer la fiche' }).click()

  //     Et se relit en français, à la même place, sans rechargement.
  const dateLisible = libelle({ day: 'numeric', month: 'long', year: 'numeric' })
  await expect(page.getByText(dateLisible)).toBeVisible()

  // --- 3. Le calendrier la range sous son jour, avec ce qu'elle est pour la collection
  const mois = iso(SORTIE).slice(0, 7)
  await page.goto(`/releases?mois=${mois}`)
  const titreDuMois = libelle({ month: 'long', year: 'numeric' })
  await expect(page.getByRole('heading', { name: titreDuMois.charAt(0).toUpperCase() + titreDuMois.slice(1) })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: libelle({ weekday: 'long', day: 'numeric', month: 'long' }) })).toBeVisible()
  const ligne = page.getByRole('link', { name: new RegExp(oeuvre) })
  await expect(ligne).toContainText(univers)
  await expect(ligne).toContainText('Date saisie sur la fiche')
  await expect(ligne).toContainText('Possédé')

  //     Le mois d'avant ne la montre pas, et le dit.
  await page.getByRole('button', { name: 'Mois précédent' }).click()
  await expect(page.getByRole('link', { name: new RegExp(oeuvre) })).toHaveCount(0)

  // --- 4. Découvrir l'annonce parmi les prochaines sorties, et « Tout voir » ramène ici
  await page.goto('/discover')
  //     En mobile le panneau est un sous-onglet ; en desktop (le navigateur de
  //     test) il est déjà déplié, et l'onglet n'existe pas à l'écran.
  const onglet = page.getByRole('tab', { name: 'Sorties' })
  if (await onglet.isVisible()) await onglet.click()
  await expect(page.getByRole('link', { name: new RegExp(oeuvre) })).toBeVisible()
  await page.getByRole('link', { name: 'Tout voir' }).last().click()
  await expect(page).toHaveURL(/\/releases/)
})
