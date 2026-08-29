import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>Voir les séries presque complètes, et ce qu'il en coûterait de les
 * finir.</b>
 *
 * <p>Septième des dix parcours structurants, et le seul qui traverse les
 * <b>trois</b> calculs du serveur d'un coup : la progression (ce qu'on
 * possède), la complétude (ce qui manque, d'après l'édition de référence) et le
 * prix (ce que ça coûte, d'après la base la plus fiable disponible). Chacun a
 * ses tests unitaires ; leur enchaînement n'en avait aucun.
 *
 * <p>Le parcours part de <b>Découvrir</b> et non de l'URL : les deux surfaces
 * qui montrent ces suggestions lisent le même endpoint, et « Tout voir » est le
 * chemin réel entre elles. Une régression de routage y est invisible autrement.
 */

test('repérer une série presque complète depuis Découvrir, et rejoindre sa fiche', async ({ page }) => {
  const titre = `Pluto ${Date.now()}`
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 8,
    tomesPossedes: [1, 2, 3, 4, 5, 6],
    // Un prix de référence : sans lui, la suggestion existe mais ne peut
    // annoncer aucun coût - et c'est précisément la moitié de sa raison d'être.
    prixNeufAuTome: 9,
  })

  // --- 1. L'aperçu de Découvrir la fait remonter
  await page.goto('/discover')
  const opportunite = page.getByRole('button', { name: new RegExp(titre) }).first()
  await expect(opportunite).toBeVisible()

  // --- 2. « Tout voir » mène à l'écran complet
  await page.getByRole('button', { name: 'Tout voir' }).first().click()
  await expect(page).toHaveURL(/\/suggestions$/)
  await expect(page.getByRole('heading', { name: "Suggestions d'achats" })).toBeVisible()

  // --- 3. Ce que la ligne annonce : l'édition, le manque, et le coût
  //
  //     Deux tomes à 9 € : 18 €, sur la base du prix neuf faute de relevé de
  //     marché. La base est NOMMÉE - « théorique » n'est pas « marché », et
  //     l'utilisateur décide en le sachant.
  const ligne = page.getByRole('button', { name: new RegExp(titre) })
  await expect(ligne).toContainText('Standard')
  await expect(ligne).toContainText('6/8 tomes')
  await expect(ligne).toContainText('2 manquants')
  await expect(ligne).toContainText('18.00 €')
  await expect(ligne).toContainText('théorique')

  // --- 4. Et elle emmène là où on peut agir
  await ligne.click()
  await expect(page).toHaveURL(new RegExp(`/entity/${entityId}$`))
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
})

test('une série complète ne se suggère pas', async ({ page }) => {
  // La règle qui rend cet écran utilisable : il ne liste QUE ce sur quoi on
  // peut agir. Une série complète y apparaîtrait comme un rappel de rien.
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
