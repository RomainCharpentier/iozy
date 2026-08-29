import type { Page } from '@playwright/test'

/**
 * Poser des données de départ par l'API, pour jouer ensuite le parcours à
 * l'écran.
 *
 * <h2>Pourquoi pas tout à la souris</h2>
 * Un manga ne s'ajoute pas à la main : les trois univers livrés exigent une
 * correspondance chez un fournisseur externe, et la pile de test n'a
 * volontairement aucune clé (voir playwright.config.ts). Or les parcours qui
 * comptent le plus - la progression « X/Y tomes », l'ajout d'un tome manquant,
 * l'édition de référence - n'existent QUE sur un manga.
 *
 * <p>Le compromis est donc explicite : <b>l'état de départ est posé par
 * l'API</b>, et tout ce que le test vérifie ensuite passe par l'écran. Ce qui
 * est testé reste le parcours ; ce qui est simulé, c'est l'existence d'une
 * collection - exactement ce qu'un utilisateur aurait déjà en arrivant.
 *
 * <h2>Le jeton CSRF, même ici</h2>
 * Ces appels partent du contexte du navigateur : ils portent donc le cookie de
 * session, et doivent porter l'en-tête anti-CSRF comme n'importe quelle
 * écriture de l'application. Sans lui, 403 - et le test échouerait sur son
 * amorçage, pas sur ce qu'il vérifie.
 */

/** L'identifiant du type « Manga », posé par la migration V1. */
export const TYPE_MANGA = '00000000-0000-0000-0000-000000000001'

async function jetonCsrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  return cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? ''
}

async function lire<T>(page: Page, chemin: string): Promise<T> {
  const reponse = await page.request.get(`http://localhost:5174/api${chemin}`)
  if (!reponse.ok()) throw new Error(`Amorçage : lecture refusée (${reponse.status()}) sur ${chemin}`)
  return (await reponse.json()) as T
}

async function modifier<T>(page: Page, chemin: string, corps: unknown): Promise<T> {
  const reponse = await page.request.patch(`http://localhost:5174/api${chemin}`, {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': await jetonCsrf(page) },
    data: corps as Record<string, unknown>,
  })
  if (!reponse.ok()) {
    throw new Error(`Amorçage refusé (${reponse.status()}) sur ${chemin} : ${await reponse.text()}`)
  }
  return (await reponse.json()) as T
}

async function ecrire<T>(page: Page, chemin: string, corps: unknown): Promise<T> {
  const reponse = await page.request.post(`http://localhost:5174/api${chemin}`, {
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': await jetonCsrf(page) },
    data: corps as Record<string, unknown>,
  })
  if (!reponse.ok()) {
    throw new Error(`Amorçage refusé (${reponse.status()}) sur ${chemin} : ${await reponse.text()}`)
  }
  return (await reponse.json()) as T
}

/**
 * Une série avec un tome possédé, et son édition de référence.
 *
 * @param totalVolumes ce qui rend « X/Y » possible - sans lui, l'application
 *                     compte les tomes sans jamais inventer de dénominateur.
 */
export async function serieAvecEdition(
  page: Page,
  options: { titre: string; edition: string; totalVolumes: number; tomePossede: number },
) {
  const { entityId } = await ecrire<{ entityId: string }>(page, '/entities/quick-add', {
    entityTypeId: TYPE_MANGA,
    title: options.titre,
    condition: 'NEW',
    volumeNumber: options.tomePossede,
    edition: options.edition,
  })

  // L'ajout rapide a DÉJÀ créé l'édition, sans son nombre de tomes : c'est
  // exactement l'état d'une vraie collection avant qu'on renseigne la fiche
  // de référence (parcours 8). On la complète donc, on ne la recrée pas -
  // le serveur refuse un doublon en 409, et il a raison.
  const edition = await lire<{ id: string }>(
    page,
    `/purchase-analysis/editions?entityId=${entityId}&seriesTitle=${encodeURIComponent(options.titre)}` +
      `&editionName=${encodeURIComponent(options.edition)}`,
  )
  await modifier(page, `/purchase-analysis/editions/${edition.id}`, {
    publisher: 'Éditeur de test',
    totalVolumes: options.totalVolumes,
  })

  return { entityId }
}
