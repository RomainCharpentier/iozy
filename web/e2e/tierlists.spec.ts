import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>Classer ses œuvres, de la liste vide au rang attribué.</b>
 *
 * <p>Le neuvième des dix parcours structurants, et celui qui traverse le plus
 * de surfaces : un écran, un dialogue de création, un panneau d'ajout, un
 * sélecteur de rang. Quatre composants dont chacun a ses tests, et dont
 * l'enchaînement n'en avait aucun - or c'est là que ça casse : une liste créée
 * qui n'apparaît pas, une œuvre ajoutée qui reste invisible, un rang choisi
 * qui ne se pose pas.
 */

test('créer une Tier List, y ajouter une œuvre, et lui donner un rang', async ({ page }) => {
  const titre = `Berserk ${Date.now()}`
  const nomDeLaListe = `Mes préférés ${Date.now()}`
  await serieAvecEdition(page, { titre, edition: 'Standard', totalVolumes: 3, tomePossede: 1 })

  // --- 1. Créer la liste
  await page.goto('/tier-lists')
  await page.getByRole('button', { name: 'Nouvelle Tier List' }).click()
  await page.getByLabel('Nom').fill(nomDeLaListe)
  await page.getByRole('button', { name: 'Manga', exact: true }).click()
  await page.getByRole('button', { name: 'Créer la Tier List' }).click()

  // Créer emmène SUR la liste : elle est vide, et c'est le moment où l'on veut
  // la remplir.
  await expect(page).toHaveURL(/\/tier-lists\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: nomDeLaListe })).toBeVisible()

  // --- 2. Y ajouter l'œuvre
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  // Le titre paraît deux fois sur la tuile (le repli de jaquette et la
  // légende) : on vise le BOUTON qui les contient, pas un des deux textes.
  await page.getByRole('button', { name: titre }).first().click()
  // Le bouton du panneau annonce COMBIEN il va ajouter - « Ajouter (1) » -
  // et il faut le viser DANS le dialogue : celui du board, derrière, porte le
  // même mot et reste dans la page.
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter (1)' }).click()

  // Ajoutée mais pas encore classée : les deux états sont distincts, et c'est
  // tout l'intérêt d'une Tier List (« dans la liste » n'est pas « rangée »).
  await expect(page.getByRole('button', { name: `${titre}, non classée` })).toBeVisible()

  // --- 3. Lui donner un rang
  await page.getByRole('button', { name: `${titre}, non classée` }).click()
  await page.getByRole('button', { name: 'S', exact: true }).click()

  await expect(page.getByRole('button', { name: `${titre}, rang S` })).toBeVisible()
  await expect(page.getByRole('button', { name: `${titre}, non classée` })).toHaveCount(0)

  // --- 4. Le retour nomme d'où l'on vient (UX-8)
  await expect(page.getByRole('button', { name: 'Tier Lists' })).toBeVisible()
})
