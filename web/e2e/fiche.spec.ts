import { expect, test } from '@playwright/test'
import { serieAvecEdition } from './amorcage'

/**
 * <b>« X/Y tomes », et le geste qui le fait bouger.</b>
 *
 * <p>Deux des dix parcours structurants, et les plus fréquents de tous : lire
 * où en est une série, et cocher le tome qu'on vient d'acheter. Ce qui se
 * vérifie ici et nulle part ailleurs, c'est la <b>chaîne complète</b> - la
 * grille annonce un tome manquant, un clic l'ajoute, le serveur écrit, la
 * progression suit. Chacun de ces maillons a son test unitaire ; leur
 * enchaînement n'en avait aucun.
 *
 * <p>L'état de départ est posé par l'API (voir `amorcage.ts`) : un manga ne
 * s'ajoute pas à la main sans fournisseur de métadonnées, et c'est justement
 * sur un manga que « X/Y » existe.
 */

test('lire la progression d’une édition, puis cocher un tome manquant', async ({ page }) => {
  const titre = `Vagabond ${Date.now()}`
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 6,
    tomePossede: 1,
  })

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // --- La progression, telle que la carte d'édition l'annonce
  await expect(page.getByText('1/6')).toBeVisible()
  // Et telle qu'un lecteur d'écran l'entend : « 3/27 » ne suffit pas.
  await expect(page.getByText('1 tome possédé sur 6')).toBeAttached()
  // Le total vient de la fiche d'édition, jamais deviné.
  await expect(page.getByText('6 tomes')).toBeVisible()

  // --- La grille dit ce qui manque
  await expect(page.getByRole('button', { name: 'Tome 1, possédé' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tome 2, manquant' })).toBeVisible()

  // --- « Je l'ai » : un clic, rien à remplir.
  //
  //     Deux gestes mènent au même endroit, et ce test a servi à découvrir
  //     lequel appartient à qui. À la SOURIS, survoler la tuile fait
  //     apparaître un calque à deux boutons (« Je l'ai » / « Je le veux »)
  //     qui recouvre entièrement la tuile : cliquer la tuile elle-même est
  //     alors impossible, le calque intercepte. Au DOIGT, il n'y a pas de
  //     survol : le calque ne se montre jamais et c'est la tuile qui reçoit
  //     le geste. Les deux appellent le même ajout, aucun chemin ne manque.
  //     Le survol vise la TUILE ENTIÈRE (le conteneur), pas le bouton du
  //     dessous : survoler la tuile elle-même est refusé pour la même raison
  //     qu'un clic - dès que le calque apparaît, c'est lui qui reçoit le
  //     pointeur. Le conteneur, lui, le contient.
  await page.getByRole('button', { name: 'Tome 2, manquant' }).locator('..').hover()
  await page.getByTitle("J'ai le tome 2").click()

  await expect(page.getByRole('button', { name: 'Tome 2, possédé' })).toBeVisible()
  // La progression a suivi - c'est le maillon qui se casse en silence quand
  // une invalidation de cache manque : le tome change d'état, le compteur non.
  await expect(page.getByText('2/6')).toBeVisible()

  // --- Et Ma collection le sait aussi, sans rechargement manuel
  await page.goto('/')
  await expect(page.getByRole('button', { name: new RegExp(`${titre}.*2/6 tomes`) })).toBeVisible()
})
