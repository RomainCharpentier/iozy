import type { WorkProgressDto } from '@/common/types/api'
import type { GiftLinkDto, SharedSpaceDto, SharedValueDto } from '@/common/types/share'

/** The words and choices of the "Partager" page and of the public page (lot 217), kept pure for tests. */

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** The title of a shared space, from what it really shows. */
export function titreEspace(data: SharedSpaceDto): string {
  if (data.giftList) return 'Liste de cadeaux'
  if (data.collection && data.wishlist) return 'Collection et envies partagées'
  if (data.collection) return 'Collection partagée'
  return 'Envies partagées'
}

/** "12 objets · 3 catégories" for a collection; "4 envies" for a list of wishes. */
export function resumeEspace(data: SharedSpaceDto): string {
  const morceaux: string[] = []
  if (data.collection) {
    const objets = data.collection.reduce((n, u) => n + u.items.length, 0)
    const categories = data.collection.length
    morceaux.push(`${objets} œuvre${objets > 1 ? 's' : ''}`)
    if (categories > 0) morceaux.push(`${categories} catégorie${categories > 1 ? 's' : ''}`)
  }
  if (data.wishlist) {
    const envies = data.wishlist.length
    morceaux.push(`${envies} envie${envies > 1 ? 's' : ''}`)
  }
  morceaux.push('en lecture seule')
  return morceaux.join(' · ')
}

/** "Valable jusqu'au 9 décembre 2026", for a gift list. */
export function libelleValidite(expiresAt: string): string {
  return `Valable jusqu’au ${DATE_LONGUE.format(new Date(expiresAt))}`
}

/** "d'après le prix neuf de 12 objets sur 20": what the number rests on. */
export function detailValeur(value: SharedValueDto): string {
  return `d’après le prix neuf de ${value.pricedCount} objet${value.pricedCount > 1 ? 's' : ''} sur ${value.totalCount}`
}


/** As many as the public page puts side by side (the server refuses a fifth). */
export const MAX_INCONTOURNABLES = 4

/** The works that can be pinned: owned today, matching the search, not pinned yet. */
export function candidats(oeuvres: WorkProgressDto[], epinglees: string[], recherche: string): WorkProgressDto[] {
  const texte = recherche.trim().toLocaleLowerCase('fr')
  return oeuvres
    .filter((oeuvre) => oeuvre.ownedCount > 0 && !epinglees.includes(oeuvre.entityId))
    .filter((oeuvre) => !texte || oeuvre.title.toLocaleLowerCase('fr').includes(texte))
}



/** "Expire le 9 décembre 2026", or that it has expired. */
export function etatListe(lien: GiftLinkDto): string {
  return lien.expired ? 'Ce lien a expiré : prolonge-le pour qu’il remarche.' : `Expire le ${DATE_LONGUE.format(new Date(lien.expiresAt))}`
}


/** The covers of the moment: the pinned works first, then what moved last. */
export function jaquettesDuPartage(oeuvres: WorkProgressDto[], epinglees: string[]): string[] {
  const parId = new Map(oeuvres.map((o) => [o.entityId, o]))
  const enTete = epinglees.map((id) => parId.get(id)).filter((o): o is WorkProgressDto => !!o)
  const suite = oeuvres.filter((o) => o.ownedCount > 0 && !epinglees.includes(o.entityId))
  return [...enTete, ...suite].map((o) => o.coverImageUrl).filter((url): url is string => !!url)
}


/** What a gift list says once its thirty days are over (410). */
export const MESSAGE_LIEN_EXPIRE = 'Ce lien a expiré.'


/** The cover of the backdrop: the first pinned work, else the first cover shown. */
export function jaquetteDeFond(data: SharedSpaceDto | undefined): string | null {
  if (!data) return null
  const premiere = [
    ...(data.pinned ?? []),
    ...(data.collection ?? []).flatMap((u) => u.items),
    ...(data.wishlist ?? []),
  ].find((oeuvre) => oeuvre.coverImageUrl)
  return premiere?.coverImageUrl ?? null
}

