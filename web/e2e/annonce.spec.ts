import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>Évaluer une annonce d'occasion avant d'acheter.</b>
 *
 * <p>Sixième des dix parcours structurants, et celui qui a le plus à perdre à
 * ne pas être joué en entier : c'est le seul écran où l'application dit à
 * quelqu'un s'il doit <b>dépenser de l'argent</b>. Le moteur a ses trente-cinq
 * tests unitaires ; ce qu'ils ne peuvent pas dire, c'est si ce qui est saisi
 * arrive au serveur, et si ce qui en revient s'affiche.
 *
 * <p>La règle vérifiée ici, et qui fait toute la différence entre cet écran et
 * une calculatrice : <b>l'annonce est confrontée à la collection</b>. Un lot
 * qui contient des tomes déjà possédés doit le dire, chiffrer ce qui reste
 * utile, et corriger le prix au-delà duquel il ne l'est plus.
 */

test('saisir une annonce, et voir les tomes déjà possédés corriger le verdict', async ({ page }) => {
  const titre = `Berserk ${Date.now()}`
  await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 40,
    tomesPossedes: [1, 2],
    prixNeufAuTome: 8,
  })

  // --- Depuis Découvrir : c'est là que vit l'analyse depuis qu'elle a quitté
  //     la barre de navigation (lot 137), avec la fiche d'une série. La barre,
  //     elle, ne la nomme plus - une destination de moins, pas un raccourci
  //     de plus.
  await page.goto('/discover')
  await page.getByRole('link', { name: /Analyser une annonce/ }).click()
  await expect(page).toHaveURL(/\/purchase-analysis$/)
  await expect(page.getByRole('heading', { name: 'Analyser une annonce' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: /Analyser une annonce/ })).toHaveCount(0)
  // Et l'écran sait d'où l'on vient.
  await expect(page.getByRole('button', { name: 'Découvrir' })).toBeVisible()

  // --- Le lot : six tomes, dont deux qu'on a déjà
  // `getByRole('textbox')` et non `getByLabel` : le bouton « Ajouter une autre
  // série au lot », juste à côté, porte lui aussi le mot « Série ».
  await page.getByRole('textbox', { name: 'Série' }).fill(titre)
  await page.getByRole('textbox', { name: 'Tomes' }).fill('1-6')

  // Le prix vit derrière un dépliant, et son libellé DIT ce qui manque
  // (« Prix, frais de port, titre… à renseigner ») plutôt que « Détails » :
  // sans prix, il n'y a rien à évaluer, et le bouton principal reste grisé.
  await page.getByRole('button', { name: /à renseigner/ }).click()
  await page.getByLabel('Prix demandé (€)').fill('30')

  // Le bouton porte ce qu'il va évaluer, pas un verbe seul.
  await page.getByRole('button', { name: 'Évaluer ce lot' }).click()

  // --- Le verdict, et de quoi le comprendre
  await expect(page.getByText("Prix de l'annonce").first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Détail par série' })).toBeVisible()

  // --- Ce que cet écran sait et qu'une calculatrice ignore
  //
  //     Les tomes 1 et 2 sont déjà dans la collection : quatre tomes utiles
  //     sur six, donc 7,50 € par tome réellement gagné et non 5 €.
  await expect(page.getByText('Tomes déjà possédés : 1, 2')).toBeVisible()
  await expect(page.getByText(/4 tomes utiles/)).toBeVisible()
  // « 7,50 € » : virgule décimale et espace fine insécable devant le symbole (lot 148).
  await expect(page.getByText(/7,50\s€\/tome utile/)).toBeVisible()
})

test('un lot sans doublon ne parle pas de doublons', async ({ page }) => {
  // Le pendant du test précédent : l'avertissement doit être une INFORMATION,
  // pas un ornement permanent. Affiché toujours, il ne veut plus rien dire.
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
