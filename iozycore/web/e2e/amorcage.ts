import type { Page } from '@playwright/test'

/**
 * Set up starting data through the API, to then play the journey on the
 * screen.
 *
 * <h2>Why not everything with the mouse</h2>
 * A manga cannot be added by hand: the three delivered universes require a
 * match at an external provider, and the test stack deliberately has no key
 * (see playwright.config.ts). Yet the journeys that matter most - the
 * "X/Y volumes" progress, adding a missing volume, the reference edition -
 * exist ONLY on a manga.
 *
 * <p>The compromise is therefore explicit: <b>the starting state is set by
 * the API</b>, and everything the test checks afterwards goes through the
 * screen. What is tested remains the journey; what is simulated is the
 * existence of a collection - exactly what a user would already have when
 * arriving.
 *
 * <h2>The CSRF token, even here</h2>
 * These calls start from the browser context: they therefore carry the
 * session cookie, and must carry the anti-CSRF header like any write of the
 * application. Without it, 403 - and the test would fail on its seeding, not
 * on what it checks.
 */

/** The identifier of the "Manga" type, set by the V1 migration. */
export const TYPE_MANGA = '00000000-0000-0000-0000-000000000001'

async function jetonCsrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  return cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? ''
}

async function lire<T>(page: Page, chemin: string): Promise<T> {
  const reponse = await page.request.get(`http://localhost:5174/api${chemin}`)
  if (!reponse.ok()) throw new Error(`Seeding: read refused (${reponse.status()}) on ${chemin}`)
  return (await reponse.json()) as T
}

async function modifier<T>(page: Page, chemin: string, corps: unknown): Promise<T> {
  const reponse = await page.request.patch(`http://localhost:5174/api${chemin}`, {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': await jetonCsrf(page) },
    data: corps as Record<string, unknown>,
  })
  if (!reponse.ok()) {
    throw new Error(`Seeding refused (${reponse.status()}) on ${chemin}: ${await reponse.text()}`)
  }
  return (await reponse.json()) as T
}

async function ecrire<T>(page: Page, chemin: string, corps: unknown): Promise<T> {
  const reponse = await page.request.post(`http://localhost:5174/api${chemin}`, {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': await jetonCsrf(page) },
    data: corps as Record<string, unknown>,
  })
  if (!reponse.ok()) {
    throw new Error(`Seeding refused (${reponse.status()}) on ${chemin}: ${await reponse.text()}`)
  }
  return (await reponse.json()) as T
}

/**
 * A series and its owned volumes, <b>without</b> a filled-in edition record.
 *
 * <p>This is the real state of a collection before journey 8: the quick add
 * created the edition on the way, but nobody has given it its number of
 * volumes yet - and without it, no "X/Y" is possible anywhere. A journey that
 * wants to SEE this gap starts here; the others go through
 * {@link serieAvecEdition}.
 *
 * <p>The volumes are added one by one by the same quick add: it deduplicates
 * by title (see QuickAddService), so the second call attaches a volume to the
 * series of the first one instead of creating a second one.
 */
export async function serieSansReference(
  page: Page,
  options: { titre: string; edition: string; tomesPossedes: number[] },
) {
  let entityId = ''
  for (const tome of options.tomesPossedes) {
    const ajout = await ecrire<{ entityId: string }>(page, '/entities/quick-add', {
      entityTypeId: TYPE_MANGA,
      title: options.titre,
      condition: 'NEW',
      volumeNumber: tome,
      edition: options.edition,
    })
    entityId = ajout.entityId
  }

  const edition = await lire<{ id: string }>(
    page,
    `/purchase-analysis/editions?entityId=${entityId}&seriesTitle=${encodeURIComponent(options.titre)}` +
      `&editionName=${encodeURIComponent(options.edition)}`,
  )
  return { entityId, editionId: edition.id }
}

/**
 * A series with its owned volumes, and its reference edition filled in.
 *
 * @param totalVolumes what makes "X/Y" possible - without it, the application
 *                     counts the volumes without ever inventing a denominator.
 * @param prixNeufAuTome optional: what gives a price reference, therefore a
 *                       cost to complete and a listing verdict other than
 *                       "I know nothing about the price".
 */
export async function serieAvecEdition(
  page: Page,
  options: {
    titre: string
    edition: string
    totalVolumes: number
    tomePossede?: number
    tomesPossedes?: number[]
    prixNeufAuTome?: number
  },
) {
  const { entityId, editionId } = await serieSansReference(page, {
    titre: options.titre,
    edition: options.edition,
    tomesPossedes: options.tomesPossedes ?? [options.tomePossede ?? 1],
  })

  // We COMPLETE the edition created by the quick add, we do not recreate it -
  // the server refuses a duplicate with 409, and it is right.
  await modifier(page, `/purchase-analysis/editions/${editionId}`, {
    publisher: 'Éditeur de test',
    totalVolumes: options.totalVolumes,
    ...(options.prixNeufAuTome === undefined ? {} : { retailPriceNewPerVolume: options.prixNeufAuTome }),
  })

  return { entityId, editionId }
}
