import { expect, test } from '@playwright/test'
import { jetonCsrf, serieAvecEdition } from './amorcage'

/**
 * <b>"X / Y", and the gesture that makes it move.</b>
 *
 * <p>Two of the ten structuring journeys, and the most frequent of all:
 * reading where a series stands, and ticking the volume we just bought. What
 * is checked here and nowhere else is the <b>complete chain</b> - the grid
 * draws a missing volume, a click adds it, the server writes, the count
 * follows. Each of these links has its unit test; their sequence had none.
 *
 * <p>Since lot 213 the page reads the work from the works read model
 * (GET /works/{id}): the count in very large figures, and a grid where what
 * is missing breathes and is named by what a click does ("Tome 2 : je l'ai").
 *
 * <p>The starting state is set by the API (see `amorcage.ts`): a manga cannot
 * be added by hand without a metadata provider, and it is precisely on a
 * manga that "X / Y" exists.
 */

test('read the progress of an edition, then tick a missing volume', async ({ page }) => {
  const titre = `Vagabond ${Date.now()}`
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Standard',
    totalVolumes: 6,
    tomePossede: 1,
  })

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // --- The count, and what is missing: the total comes from the edition, never guessed.
  await expect(page.getByText('1 / 6')).toBeVisible()
  // Read aloud in words, not "1 slash 6".
  await expect(page.getByText('1 possédé sur 6')).toBeAttached()
  await expect(page.getByText('Il t’en manque 5')).toBeVisible()

  // --- The grid: an owned volume is named by itself, a missing one by what a click does.
  await expect(page.getByRole('button', { name: 'Tome 1', exact: true })).toBeVisible()
  await page.getByRole('button', { name: "Tome 2 : je l'ai" }).click()

  // The count followed - this is the link that breaks silently when a cache
  // invalidation is missing: the volume changes state, the counter does not.
  await expect(page.getByRole('button', { name: 'Tome 2', exact: true })).toBeVisible()
  await expect(page.getByText('2 / 6')).toBeVisible()
  await expect(page.getByText('Il t’en manque 4')).toBeVisible()

  // --- Removing takes two clicks, in place, and no dialog.
  await page.getByRole('button', { name: 'Tome 2', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retirer Tome 2' }).click()
  await expect(page.getByRole('button', { name: "Tome 2 : je l'ai" })).toBeVisible()
  await expect(page.getByText('1 / 6')).toBeVisible()
  await page.getByRole('button', { name: "Tome 2 : je l'ai" }).click()
  await expect(page.getByText('2 / 6')).toBeVisible()

  // --- And Ma collection knows it too, without a manual reload
  await page.goto('/collection')
  await expect(page.getByRole('button', { name: new RegExp(`${titre}.*2/6 tomes`) })).toBeVisible()
})

test('a paused series keeps its gaps drawn, but no longer counts them', async ({ page }) => {
  const titre = `Berserk ${Date.now()}`
  const { entityId } = await serieAvecEdition(page, {
    titre,
    edition: 'Prestige',
    totalVolumes: 4,
    tomePossede: 1,
  })

  await page.goto(`/entity/${entityId}`)
  await expect(page.getByText('Il t’en manque 3')).toBeVisible()

  await page.getByRole('radio', { name: 'En pause' }).click()
  await expect(page.getByText('En pause : ce qui manque ne compte plus')).toBeVisible()
  await expect(page.getByText(/Il t’en manque/)).toHaveCount(0)
  // Still drawn, still a click away.
  await expect(page.getByRole('button', { name: "Tome 2 : je l'ai" })).toBeVisible()

  // The status is the collector's word, kept by the server.
  await page.reload()
  await expect(page.getByRole('radio', { name: 'En pause' })).toBeChecked()
  await expect(page.getByText(/Il t’en manque/)).toHaveCount(0)

  // Back to "en cours": the gaps count again.
  await page.getByRole('radio', { name: 'En cours' }).click()
  await expect(page.getByText('Il t’en manque 3')).toBeVisible()
})

test('set every missing volume aside in one click', async ({ page }) => {
  const titre = `Dorohedoro ${Date.now()}`
  const { entityId } = await serieAvecEdition(page, { titre, edition: 'Standard', totalVolumes: 3, tomePossede: 1 })

  await page.goto(`/entity/${entityId}`)
  await page.getByRole('button', { name: 'Mettre les 2 manquants de côté' }).click()

  await expect
    .poll(async () => {
      const envies = (await (await page.request.get('/api/wishlist')).json()) as { entityId: string }[]
      return envies.filter((envie) => envie.entityId === entityId).length
    })
    .toBe(2)
  // Wished now: nothing is left to set aside.
  await expect(page.getByRole('button', { name: /de côté$/ })).toHaveCount(0)
})

/**
 * "Je l'ai" on a whole game keeps its console: the only one the source lists,
 * or the one picked in place when it lists several. Without it, every game
 * waited under "Console à préciser".
 */
test('own a whole game on its console', async ({ page }) => {
  await page.goto('/')
  const types = (await (await page.request.get('/api/entity-types')).json()) as { id: string; code: string }[]
  const jeuVideo = types.find((type) => type.code === 'VIDEO_GAME')
  expect(jeuVideo).toBeDefined()

  async function jeuNonPossede(titre: string, platforms: string): Promise<string> {
    const csrf = { 'X-XSRF-TOKEN': await jetonCsrf(page) }
    const ajout = await page.request.post('/api/entities/quick-add', {
      headers: csrf,
      data: { entityTypeId: jeuVideo?.id, title: titre, condition: 'NEW', attributes: { platforms } },
    })
    expect(ajout.ok()).toBe(true)
    const { entityId } = (await ajout.json()) as { entityId: string }
    const copies = (await (await page.request.get(`/api/ownerships?entityId=${entityId}`)).json()) as { id: string }[]
    for (const copie of copies) {
      expect((await page.request.delete(`/api/ownerships/${copie.id}`, { headers: csrf })).ok()).toBe(true)
    }
    return entityId
  }

  async function consoleDe(entityId: string) {
    const copies = (await (await page.request.get(`/api/ownerships?entityId=${entityId}`)).json()) as {
      platform: string | null
      status: string
    }[]
    return copies.find((copie) => copie.status === 'OWNED')?.platform
  }

  // --- One console: it is that one, no question.
  const seul = `Jeu seul ${Date.now()}`
  const idSeul = await jeuNonPossede(seul, 'Console A')
  await page.goto(`/entity/${idSeul}`)
  await page.getByRole('button', { name: `${seul} : je l'ai` }).click()
  await expect.poll(() => consoleDe(idSeul)).toBe('Console A')

  // --- Several: the page asks which one, in place, before adding.
  const double = `Jeu double ${Date.now()}`
  const idDouble = await jeuNonPossede(double, 'Console A, Console B')
  await page.goto(`/entity/${idDouble}`)
  await page.getByRole('button', { name: `${double} : je l'ai` }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Console B' }).click()
  await page.getByRole('button', { name: "Je l'ai", exact: true }).click()
  await expect.poll(() => consoleDe(idDouble)).toBe('Console B')
})
