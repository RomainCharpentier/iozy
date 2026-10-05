import { expect, test } from '@playwright/test'
import { TYPE_MANGA, serieAvecEdition } from './amorcage'

/**
 * <b>Visit without an account: the catalog, nothing personal, and no write.</b>
 *
 * <p>This is the only door of the application open to the whole Internet
 * without anything to authorize (see AuthPage) - and therefore the only path
 * through which a leak of personal data would go unseen: nobody complains
 * about what a stranger has read. The HTTP contract tests say that the visit
 * session names no owner; this journey checks what that GIVES, screen by
 * screen, facing a collection that really exists.
 *
 * <p>The account of the suite owns a volume: this is precisely what the
 * visitor must not see. And the refusal to write is checked in the two places
 * where it lives - on the screen, in one sentence, with no round trip; and on
 * the server, with 403, with the CSRF token that any legitimate write carries,
 * so that the refusal really comes from the visit and from nothing else.
 */

const ORIGINE = 'http://localhost:5174'

test('visit without an account: the catalog, nothing personal, and no write', async ({ page, browser }) => {
  const titre = `Blame ${Date.now()}`
  // What the account owns - and what a visitor must never see.
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Deluxe',
    totalVolumes: 3,
    tomePossede: 1,
    prixNeufAuTome: 15,
  })

  // --- A visitor: new context, no cookie inherited from the account session
  const visiteur = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const pageVisiteur = await visiteur.newPage()
  await pageVisiteur.goto('/')
  await expect(pageVisiteur.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await pageVisiteur.getByRole('button', { name: 'Visiter sans compte' }).click()

  // --- The catalog, and the banner that says what we are looking at
  await expect(pageVisiteur).toHaveURL(/\/add$/)
  await expect(pageVisiteur.getByText('Mode visiteur')).toBeVisible()
  await expect(pageVisiteur.getByRole('heading', { name: 'Catalogue' })).toBeVisible()
  // Neither "Ma collection", nor the add entries: we do not show a door that
  // bounces back (see lib/accesInvite).
  await expect(pageVisiteur.getByRole('link', { name: 'Ma collection' })).toHaveCount(0)
  await expect(pageVisiteur.getByRole('link', { name: 'Scanner' })).toHaveCount(0)

  // The work is there - it is the catalog - but with no ownership badge:
  // "Possédé" would talk about somebody else's collection.
  const ligne = pageVisiteur.getByRole('button', { name: titre })
  await expect(ligne).toBeVisible()
  await expect(pageVisiteur.getByText('Possédé', { exact: true })).toHaveCount(0)
  await expect(pageVisiteur.getByText('Pas encore possédé')).toHaveCount(0)
  await ligne.click()

  // --- The detail page: the volumes of the catalog, and none is "possédé"
  await expect(pageVisiteur).toHaveURL(new RegExp(`/entity/${entityId}$`))
  await expect(pageVisiteur.getByRole('heading', { name: titre })).toBeVisible()
  // Volume 1 is indeed the account's one - and the visitor sees it MISSING:
  // the progress is theirs, that is nobody's, not the host's.
  await expect(pageVisiteur.getByRole('button', { name: 'Tome 1, manquant' })).toBeVisible()
  await expect(pageVisiteur.getByRole('button', { name: /^Tome \d+, possédé$/ })).toHaveCount(0)
  await expect(pageVisiteur.getByText('0 tome possédé sur 3')).toBeAttached()
  await expect(pageVisiteur.getByRole('button', { name: 'Éditer' })).toHaveCount(0)

  // --- A write gesture: refused in one sentence, with no round trip
  await pageVisiteur.getByRole('button', { name: 'Tome 2, manquant' }).locator('..').hover()
  await pageVisiteur.getByTitle("J'ai le tome 2").click()
  await expect(
    pageVisiteur.getByText('Tu visites cette collection en lecture seule. Il faut un compte pour y changer quoi que ce soit.'),
  ).toBeVisible()
  await expect(pageVisiteur.getByRole('button', { name: 'Tome 2, manquant' })).toBeVisible()

  // --- The screens reserved for accounts send back to the catalog
  for (const chemin of ['/', '/profile', '/profile/import', '/administration/comptes']) {
    await pageVisiteur.goto(chemin)
    await expect(pageVisiteur).toHaveURL(/\/add$/)
  }

  // --- And on the API side, with the visitor session: nothing personal, 403 on any write
  const moi = await (await pageVisiteur.request.get(`${ORIGINE}/api/auth/me`)).json()
  expect(moi).toMatchObject({ invite: true, id: null, email: null })

  const possessions = await (await pageVisiteur.request.get(`${ORIGINE}/api/ownerships`)).json()
  expect(possessions).toEqual([])

  // The export is the widest read of the application: it returns the catalog
  // - and nothing of what someone made of it.
  const exportVisiteur = await (await pageVisiteur.request.get(`${ORIGINE}/api/export/json`)).json()
  expect(exportVisiteur.entities.map((e: { title: string }) => e.title)).toContain(titre)
  expect(exportVisiteur.ownerships).toEqual([])
  expect(exportVisiteur.wishlist).toEqual([])
  expect(exportVisiteur.experiences).toEqual([])

  // The CSRF token is provided: if the refusal comes, it comes from the visit.
  const jeton = (await visiteur.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value ?? ''
  const ecriture = await pageVisiteur.request.post(`${ORIGINE}/api/entities/quick-add`, {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': jeton },
    data: { entityTypeId: TYPE_MANGA, title: 'Intrusion', condition: 'NEW', volumeNumber: 1, edition: 'Deluxe' },
  })
  expect(ecriture.status()).toBe(403)
  expect(await ecriture.json()).toEqual({ error: expect.stringContaining('lecture seule') })

  // The account still owns its volume - and only one: nothing was written for it.
  const chezLeCompte = await (await page.request.get(`${ORIGINE}/api/ownerships?entityId=${entityId}`)).json()
  expect(chezLeCompte).toHaveLength(1)

  // --- Leaving closes the visit, for good
  await pageVisiteur.getByRole('button', { name: 'Quitter' }).first().click()
  await expect(pageVisiteur.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await pageVisiteur.goto(`/entity/${entityId}`)
  await expect(pageVisiteur.getByRole('heading', { name: 'Se connecter' })).toBeVisible()
  await expect(pageVisiteur.getByText(titre)).toHaveCount(0)

  await visiteur.close()
})
