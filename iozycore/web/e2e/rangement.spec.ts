import { expect, test } from '@playwright/test'
import { jetonCsrf } from './amorcage'

/**
 * A video game finds its place on the shelves: its console is said on its
 * detail page, and My collection puts it under that console and its publisher.
 * The stack has no provider key, so the publisher arrives with the add.
 */
test('say the console of a game on its detail page, then find it on its shelf', async ({ page }) => {
  const titre = `Jeu rangé ${Date.now()}`
  await page.goto('/')
  const types = (await (await page.request.get('/api/entity-types')).json()) as { id: string; code: string }[]
  const jeuVideo = types.find((type) => type.code === 'VIDEO_GAME')
  expect(jeuVideo).toBeDefined()
  const ajout = await page.request.post('/api/entities/quick-add', {
    headers: { 'X-XSRF-TOKEN': await jetonCsrf(page) },
    data: {
      entityTypeId: jeuVideo?.id,
      title: titre,
      condition: 'NEW',
      attributes: { publisher: 'Éditeur de test', platforms: 'Console A, Console B' },
    },
  })
  expect(ajout.ok()).toBe(true)
  const { entityId } = (await ajout.json()) as { entityId: string }

  // --- Not said yet: the game waits, nothing is guessed
  await page.goto('/')
  const salle = page.getByRole('region', { name: 'Jeu vidéo' })
  await expect(salle.getByRole('heading', { name: 'Console à préciser' })).toBeVisible()

  // --- Said on the detail page
  await page.goto(`/entity/${entityId}`)
  await page.getByLabel('Console de cet exemplaire').fill('Console B')
  await page.getByLabel('Console de cet exemplaire').press('Enter')
  await expect
    .poll(async () => {
      const copies = (await (await page.request.get(`/api/ownerships?entityId=${entityId}`)).json()) as { platform: string }[]
      return copies[0]?.platform
    })
    .toBe('Console B')

  // --- And on the shelf, in its place
  await page.goto('/')
  await expect(salle.getByRole('heading', { name: 'Console B' })).toBeVisible()
  await expect(salle.getByRole('heading', { name: 'Éditeur de test' })).toBeVisible()
  await expect(salle.getByRole('button', { name: new RegExp(titre) })).toBeVisible()

  // --- The detail page always has its way back: an installed app has no Back button
  await salle.getByRole('button', { name: new RegExp(titre) }).click()
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
  await page.getByRole('button', { name: 'Ma collection' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(salle.getByRole('button', { name: new RegExp(titre) })).toBeVisible()

  // --- "Tout voir" opens the same room, and the way back names it
  await salle.getByRole('link', { name: /^Tout voir/ }).click()
  await expect(page).toHaveURL(/collection/)
  await expect(page.getByRole('heading', { name: 'Console B' })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(titre) }).click()
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
  await page.getByRole('button', { name: 'Jeu vidéo' }).click()
  await expect(page).toHaveURL(/collection/)

  // --- Even without an origin: a received link, a reload
  await page.goto(`/entity/${entityId}`)
  await expect(page.getByRole('button', { name: 'Ma collection' })).toBeVisible()
})
