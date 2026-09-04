import { expect, test } from '@playwright/test'
import { serieSansReference } from './amorcage'

/**
 * <b>Renseigner l'édition de référence — celle qui rend tous les « X/Y »
 * possibles.</b>
 *
 * <p>Huitième des dix parcours structurants, et le seul dont l'effet se voit
 * <b>ailleurs</b> que là où on agit : on remplit deux champs sur une fiche, et
 * c'est la progression de toute l'application qui devient calculable. Tant que
 * le nombre de tomes est inconnu, l'app compte ce qu'elle a (« 2 tomes ») sans
 * jamais inventer de dénominateur — pas de « 2/? », qui se lirait comme une
 * donnée manquante alors que le numérateur, lui, est parfaitement su.
 *
 * <p>Ce que ce parcours vérifie et qu'aucun test unitaire ne peut : que le
 * formulaire écrit vraiment dans la bonne édition, et que les <b>caches</b> qui
 * portent la progression sont invalidés. Une écriture réussie suivie d'un
 * écran qui affiche encore l'état d'avant ne casse aucune règle — c'est
 * exactement le défaut qui survit à une suite verte.
 */

test('renseigner le nombre de tomes d’une édition, et voir « X/Y » apparaître', async ({ page }) => {
  const titre = `Monster ${Date.now()}`
  const { entityId } = await serieSansReference(page, {
    titre,
    edition: 'Standard',
    tomesPossedes: [1, 2],
  })

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // --- Avant : ce qu'on possède, et l'aveu que le reste est inconnu
  await expect(page.getByText('2 tomes', { exact: true })).toBeVisible()
  await expect(page.getByText('Détails à renseigner')).toBeVisible()

  // --- Renseigner la fiche de référence
  //
  //     Un seul « Éditer » pour toute la page (Lot 129-130) : les rangées de
  //     l'inspecteur deviennent des champs, à la même place, et une seule
  //     barre les enregistre.
  await page.getByRole('button', { name: 'Éditer' }).click()
  await page.getByPlaceholder('Nb de tomes').fill('18')
  await page.getByPlaceholder('Éditeur (ex: Kana)').fill('Kana')
  await page.getByRole('button', { name: 'Enregistrer la fiche' }).click()

  // --- Après : la progression existe, sur le même écran, sans rechargement
  await expect(page.getByText('2/18')).toBeVisible()
  await expect(page.getByText('Kana · 18 tomes')).toBeVisible()
  // Et telle qu'un lecteur d'écran l'entend - « 2/18 » ne suffit pas.
  await expect(page.getByText('2 tomes possédés sur 18')).toBeAttached()

  // --- Et ailleurs : Ma collection le sait aussi
  //
  //     C'est le vrai enjeu du parcours. La progression vient du serveur en un
  //     seul appel pour toute la collection ; si son cache n'est pas invalidé,
  //     cet écran-ci affiche 2/18 pendant que l'autre compte encore des tomes
  //     sans total.
  await page.goto('/')
  await expect(page.getByRole('button', { name: new RegExp(`${titre}.*2/18 tomes`) })).toBeVisible()
})
