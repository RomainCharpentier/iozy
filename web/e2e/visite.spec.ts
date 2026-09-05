import { expect, test } from '@playwright/test'
import { TYPE_MANGA, serieAvecEdition } from './amorcage'

/**
 * <b>Visiter sans compte : le catalogue, rien de personnel, et aucune écriture.</b>
 *
 * <p>C'est la seule porte de l'application ouverte à tout Internet sans
 * qu'on ait rien à autoriser (voir AuthPage) - et donc le seul chemin par
 * lequel une fuite de données personnelles ne se verrait pas : personne ne
 * se plaint de ce qu'un inconnu a lu. Les tests de contrat HTTP disent que
 * la session de visite ne nomme aucun propriétaire ; ce parcours vérifie ce
 * que ça DONNE, écran par écran, face à une collection qui existe vraiment.
 *
 * <p>Le compte de la suite possède un tome : c'est précisément ce que le
 * visiteur ne doit pas voir. Et le refus d'écrire est vérifié aux deux
 * endroits où il vit - à l'écran, en une phrase, sans aller-retour ; et au
 * serveur, en 403, avec le jeton CSRF que porte n'importe quelle écriture
 * légitime, pour que le refus vienne bien de la visite et de rien d'autre.
 */

const ORIGINE = 'http://localhost:5174'

test('visiter sans compte : le catalogue, rien de personnel, et aucune écriture', async ({ page, browser }) => {
  const titre = `Blame ${Date.now()}`
  // Ce que le compte possède - et qu'un visiteur ne doit jamais voir.
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Deluxe',
    totalVolumes: 3,
    tomePossede: 1,
    prixNeufAuTome: 15,
  })

  // --- Un visiteur : contexte neuf, aucun cookie hérité de la session du compte
  const visiteur = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const pageVisiteur = await visiteur.newPage()
  await pageVisiteur.goto('/')
  await expect(pageVisiteur.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await pageVisiteur.getByRole('button', { name: 'Visiter sans compte' }).click()

  // --- Le catalogue, et le bandeau qui dit ce qu'on regarde
  await expect(pageVisiteur).toHaveURL(/\/add$/)
  await expect(pageVisiteur.getByText('Mode visiteur')).toBeVisible()
  await expect(pageVisiteur.getByRole('heading', { name: 'Catalogue' })).toBeVisible()
  // Ni « Ma collection », ni les entrées d'ajout : on ne montre pas une
  // porte qui rebondit (voir lib/accesInvite).
  await expect(pageVisiteur.getByRole('link', { name: 'Ma collection' })).toHaveCount(0)
  await expect(pageVisiteur.getByRole('link', { name: 'Scanner' })).toHaveCount(0)

  // L'œuvre est là - c'est le catalogue - mais sans pastille de possession :
  // « Possédé » parlerait de la collection de quelqu'un d'autre.
  const ligne = pageVisiteur.getByRole('button', { name: titre })
  await expect(ligne).toBeVisible()
  await expect(pageVisiteur.getByText('Possédé', { exact: true })).toHaveCount(0)
  await expect(pageVisiteur.getByText('Pas encore possédé')).toHaveCount(0)
  await ligne.click()

  // --- La fiche : les tomes du catalogue, et aucun n'est « possédé »
  await expect(pageVisiteur).toHaveURL(new RegExp(`/entity/${entityId}$`))
  await expect(pageVisiteur.getByRole('heading', { name: titre })).toBeVisible()
  // Le tome 1 est bien celui du compte - et le visiteur le voit MANQUANT :
  // la progression est la sienne, c'est-à-dire personne, pas celle de l'hôte.
  await expect(pageVisiteur.getByRole('button', { name: 'Tome 1, manquant' })).toBeVisible()
  await expect(pageVisiteur.getByRole('button', { name: /^Tome \d+, possédé$/ })).toHaveCount(0)
  await expect(pageVisiteur.getByText('0 tome possédé sur 3')).toBeAttached()
  await expect(pageVisiteur.getByRole('button', { name: 'Éditer' })).toHaveCount(0)

  // --- Un geste d'écriture : refusé en une phrase, sans aller-retour
  await pageVisiteur.getByRole('button', { name: 'Tome 2, manquant' }).locator('..').hover()
  await pageVisiteur.getByTitle("J'ai le tome 2").click()
  await expect(
    pageVisiteur.getByText('Tu visites cette collection en lecture seule. Il faut un compte pour y changer quoi que ce soit.'),
  ).toBeVisible()
  await expect(pageVisiteur.getByRole('button', { name: 'Tome 2, manquant' })).toBeVisible()

  // --- Les écrans réservés aux comptes renvoient au catalogue
  for (const chemin of ['/', '/profile', '/settings/import', '/administration/comptes']) {
    await pageVisiteur.goto(chemin)
    await expect(pageVisiteur).toHaveURL(/\/add$/)
  }

  // --- Et côté API, avec la session du visiteur : rien de personnel, 403 à toute écriture
  const moi = await (await pageVisiteur.request.get(`${ORIGINE}/api/auth/me`)).json()
  expect(moi).toMatchObject({ invite: true, id: null, email: null })

  const possessions = await (await pageVisiteur.request.get(`${ORIGINE}/api/ownerships`)).json()
  expect(possessions).toEqual([])

  // L'export est la lecture la plus large de l'application : il rend le
  // catalogue - et rien de ce que quelqu'un en a fait.
  const exportVisiteur = await (await pageVisiteur.request.get(`${ORIGINE}/api/export/json`)).json()
  expect(exportVisiteur.entities.map((e: { title: string }) => e.title)).toContain(titre)
  expect(exportVisiteur.ownerships).toEqual([])
  expect(exportVisiteur.wishlist).toEqual([])
  expect(exportVisiteur.experiences).toEqual([])

  // Le jeton CSRF est fourni : si le refus vient, il vient de la visite.
  const jeton = (await visiteur.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? ''
  const ecriture = await pageVisiteur.request.post(`${ORIGINE}/api/entities/quick-add`, {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': jeton },
    data: { entityTypeId: TYPE_MANGA, title: 'Intrusion', condition: 'NEW', volumeNumber: 1, edition: 'Deluxe' },
  })
  expect(ecriture.status()).toBe(403)
  expect(await ecriture.json()).toEqual({ error: expect.stringContaining('lecture seule') })

  // Le compte, lui, possède toujours son tome - et un seul : rien n'a été écrit chez lui.
  const chezLeCompte = await (await page.request.get(`${ORIGINE}/api/ownerships?entityId=${entityId}`)).json()
  expect(chezLeCompte).toHaveLength(1)

  // --- Quitter referme la visite, pour de bon
  await pageVisiteur.getByRole('button', { name: 'Quitter' }).first().click()
  await expect(pageVisiteur.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await pageVisiteur.goto(`/entity/${entityId}`)
  await expect(pageVisiteur.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await expect(pageVisiteur.getByText(titre)).toHaveCount(0)

  await visiteur.close()
})
