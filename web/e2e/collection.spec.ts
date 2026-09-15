import { expect, test } from '@playwright/test'

/**
 * <b>Du clic à la base : créer un univers, y ajouter une œuvre, la retrouver.</b>
 *
 * <p>C'est le parcours fondateur — sans lui, il n'y a pas de collection. Et
 * c'est celui qu'aucun test unitaire ne peut couvrir : chacun des quatre
 * écrans traversés est juste tout seul, ce qui se casse ici, c'est le
 * <b>passage</b> de l'un à l'autre — un formulaire branché sur la mauvaise
 * route, un cache qu'on oublie d'invalider, et l'écran suivant reste sur
 * l'état d'avant sans que rien ne le signale.
 *
 * <h2>Pourquoi un type créé pour l'occasion</h2>
 * Les trois univers livrés (manga, jeu vidéo, jeu de société) exigent une
 * correspondance chez un fournisseur externe. La pile de test n'a
 * volontairement AUCUNE clé d'API : un test qui dépend de Jikan échoue le jour
 * où Jikan tousse, pour une raison qui n'a rien à voir avec l'application. Un
 * type créé à la main n'a pas de fournisseur, et ouvre donc la saisie libre -
 * ce qui exerce en prime l'éditeur de types.
 *
 * <h2>Un seul test, et c'est délibéré</h2>
 * Découper « ajouter » et « ne pas dupliquer » en deux tests demanderait au
 * second de retrouver ce que le premier a créé - or Playwright redémarre son
 * worker après un échec, et les constantes du module sont alors recalculées.
 * Le second test cherchait un univers au nom légèrement différent de celui
 * créé par le premier (constaté). Un parcours qui se lit d'un bout à l'autre
 * n'a pas ce problème.
 */

test('créer un univers, y ajouter une œuvre, et la retrouver plutôt que la dupliquer', async ({ page }) => {
  // Un nom par exécution : deux lancements ne doivent pas se gêner.
  const univers = `Vinyle ${Date.now()}`
  const oeuvre = 'Discovery'

  // --- 1. Un univers à soi (Paramètres ▸ Administration ▸ Types)
  await page.goto('/types/new')
  await page.getByLabel('Label').fill(univers)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()

  await expect(page).toHaveURL(/\/types$/)
  await expect(page.getByText(univers)).toBeVisible()

  // --- 2. L'ajouter depuis Rechercher
  await page.goto('/add')

  // Les trois façons d'ajouter à sa collection sont réunies ici : taper un
  // titre, scanner, importer. L'import BGG a vécu sous Administration jusqu'au
  // 2026-08-29 - il n'a jamais rien eu d'administratif.
  await expect(page.getByRole('link', { name: 'Scanner' })).toHaveAttribute('href', '/scan')
  await expect(page.getByRole('link', { name: 'Importer depuis BGG' })).toHaveAttribute('href', '/import-bgg')

  await page.getByRole('button', { name: univers }).click()
  await page.getByLabel(/Titre|Un titre/).fill(oeuvre)

  // Sur un type sans fournisseur, ce bouton est le SEUL chemin d'ajout.
  await page.getByRole('button', { name: `Ajouter « ${oeuvre} »` }).click()

  // --- 3. L'aperçu dit ce qu'il est : une œuvre pas encore possédée
  await expect(page.getByText("Cette œuvre n'est pas encore dans ta collection.")).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter à ma collection' }).click()

  // --- 4. On arrive sur SA fiche, pas sur une page générique
  await expect(page).toHaveURL(/\/entity\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: oeuvre })).toBeVisible()

  // --- 5. Ma collection la montre, avec son rail et ses compteurs
  //
  //     Le décompte lu ici est celui du RAIL de cet univers, pas le total de
  //     la collection : ce test partage sa pile avec les autres parcours, qui
  //     y sèment leurs propres séries. La première version affirmait « 1 titre
  //     suivi » et ne tenait que tant que ce fichier passait en premier - elle
  //     est tombée le jour où un parcours au nom alphabétiquement antérieur
  //     est arrivé. Un test dont la vérité dépend de l'ordre des fichiers ne
  //     vérifie pas ce qu'il croit.
  //     Et depuis le lot « Suivre » (e4dd418), le décompte de la vue « Tout »
  //     dit « N titres » tout court - « suivis » est devenu un filtre à part.
  await page.goto('/')
  await expect(page.getByText(/\d+ titres?( ·|$)/)).toBeVisible()
  await expect(page.getByRole('heading', { name: univers })).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(`^${univers} 1 Tout voir$`) })).toBeVisible()
  // La tuile porte le titre ET son état : « Possédé » plutôt qu'un décompte de
  // tomes, parce que pour un type sans notion de tome, l'œuvre EST l'objet
  // collectionnable.
  await expect(page.getByRole('button', { name: `${oeuvre} Possédé` })).toBeVisible()

  // --- 6. La rechercher à nouveau la RETROUVE, au lieu de proposer un doublon
  await page.goto('/add')
  await page.getByRole('button', { name: univers }).click()
  await page.getByLabel(/Titre|Un titre/).fill(oeuvre)

  const dejaLa = page.getByText('Déjà dans IozyCore')
  const ajouterQuandMeme = page.getByRole('button', { name: `Ajouter « ${oeuvre} »` })
  await expect(dejaLa).toBeVisible()

  // Le bouton d'ajout reste là - et c'est voulu : sur un type sans
  // fournisseur, il est le seul chemin, et deux œuvres peuvent porter des
  // titres proches. Ce qui protège du doublon, c'est l'ORDRE : ce qu'on
  // possède déjà se montre AVANT de proposer de créer. Le premier jet de ce
  // test affirmait l'inverse (bouton absent) et il avait tort.
  await expect(ajouterQuandMeme).toBeVisible()
  const positionDeja = (await dejaLa.boundingBox())?.y ?? 0
  const positionBouton = (await ajouterQuandMeme.boundingBox())?.y ?? 0
  expect(positionDeja).toBeLessThan(positionBouton)
})
