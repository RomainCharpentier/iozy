import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '@/common/lib/coverImage'
import type { MetadataCandidateDto } from '@/common/types/api'

/**
 * Ask the source again what it knows about a work already in the collection.
 *
 * <h2>Why this module</h2>
 * The attributes of a work (mangaka, status, number of volumes, cover,
 * external ids) are copied from a provider AT THE TIME OF THE ADD,
 * then never again: an ongoing series kept forever the number of
 * volumes it had the day it was added, and a page added by
 * hand had nothing at all. There was no way to ask for them again
 * (user request of 2026-08-27: "je veux un bouton pour recharger les
 * images ou les infos api").
 *
 * <h2>Two pure functions, testable by eye</h2>
 * The choice of the candidate and the computation of what must be written live here, outside
 * React and outside the network - these are the two places where a mistake
 * would overwrite user data.
 */

/** The work as needed here - never the whole response. */
export interface OeuvreARecharger {
  title: string
  attributes: Record<string, unknown>
  /** The keys entered by hand (Batch 130) - never rewritten. The server
   *  applies the same rule; here it is used for the count shown on screen. */
  champsSaisis?: string[]
}

/** The keys under which the provider id lives, depending on the collection
 * type (see the internals of useBrouillonInspecteur). */
const CLES_IDENTIFIANT = ['malId', 'igdbId', 'bggId']

/** Never reloaded: it is the user's remark, not a piece of
 * source data. The attribute bag mixes both (see EntityDetailPage). */
const CLES_UTILISATEUR = ['note']

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim() !== '' ? valeur.trim() : null
}

function normaliser(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The source ids a work carries (`{ bggId: '822' }`): what names it for
 * `detailsOeuvre`. Empty for a work added by hand.
 */
export function identifiantsSource(attributes: Record<string, unknown>): Record<string, string> {
  const identifiants: Record<string, string> = {}
  for (const cle of CLES_IDENTIFIANT) {
    const valeur = texte(attributes[cle])
    if (valeur !== null) identifiants[cle] = valeur
  }
  return identifiants
}

/**
 * A search candidate completed with the details of its work (batch 160).
 *
 * <p>The candidate always wins: a detail only fills what the search left
 * empty. The cover of the details becomes the `imageUrl` of the candidate, so
 * every reader of a candidate finds it at the usual place.
 */
export function avecDetails(candidat: MetadataCandidateDto, details: Record<string, unknown>): MetadataCandidateDto {
  const { [COVER_IMAGE_ATTRIBUTE_KEY]: couverture, ...autres } = details
  return {
    ...candidat,
    imageUrl: candidat.imageUrl ?? texte(couverture),
    attributes: { ...autres, ...candidat.attributes },
  }
}

/**
 * Which of these candidates IS this work?
 *
 * The provider id first (malId/igdbId/bggId, already stored since
 * the add): it is the only safe match. Failing that, the exact title, ignoring
 * accents and case - never an "approximately" match, which would quietly copy
 * the information of a spin-off onto the parent series.
 */
export function candidatCorrespondant(
  candidats: MetadataCandidateDto[],
  oeuvre: OeuvreARecharger,
): MetadataCandidateDto | null {
  const identifiants = CLES_IDENTIFIANT.map((cle) => texte(oeuvre.attributes[cle])).filter(
    (valeur): valeur is string => valeur !== null,
  )
  if (identifiants.length > 0) {
    const parIdentifiant = candidats.find(
      (candidat) =>
        identifiants.includes(candidat.externalId) ||
        CLES_IDENTIFIANT.some((cle) => {
          const valeur = texte(candidat.attributes[cle])
          return valeur !== null && identifiants.includes(valeur)
        }),
    )
    if (parIdentifiant) return parIdentifiant
  }

  const titre = normaliser(oeuvre.title)
  return candidats.find((candidat) => normaliser(candidat.title) === titre) ?? null
}

/**
 * What must be written, and NOTHING more.
 *
 * <p>Only the keys that the source really provides, and only when
 * their value differs from the one already in the database: the count shown on screen must
 * be able to say "everything is already up to date" without lying.
 *
 * <p><b>Three exclusions.</b> The keys ENTERED BY HAND (Batch 130: "si on
 * recharge depuis l'api alors on écrase les infos non déjà éditées"). The
 * user's remarks, which come from no source. And the cover
 * of the series, which is ONLY SET IF IT IS MISSING: it is chosen by hand
 * on the detail page (see the cover control), and a reload must not
 * undo that choice.
 */
export function attributsARecharger(
  candidat: MetadataCandidateDto,
  oeuvre: OeuvreARecharger,
): Record<string, unknown> {
  const aEcrire: Record<string, unknown> = {}
  const saisis = oeuvre.champsSaisis ?? []
  for (const [cle, valeur] of Object.entries(candidat.attributes)) {
    if (CLES_UTILISATEUR.includes(cle) || cle === COVER_IMAGE_ATTRIBUTE_KEY || saisis.includes(cle)) continue
    if (valeur === null || valeur === undefined || valeur === '') continue
    if (JSON.stringify(valeur) === JSON.stringify(oeuvre.attributes[cle])) continue
    aEcrire[cle] = valeur
  }

  if (candidat.imageUrl && !coverImageUrlFrom(oeuvre.attributes) && !saisis.includes(COVER_IMAGE_ATTRIBUTE_KEY)) {
    aEcrire[COVER_IMAGE_ATTRIBUTE_KEY] = candidat.imageUrl
  }

  return aEcrire
}
