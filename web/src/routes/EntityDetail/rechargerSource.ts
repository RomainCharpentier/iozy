import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import type { MetadataCandidateDto } from '../../types/api'

/**
 * Redemander à la source ce qu'elle sait d'une œuvre déjà en collection.
 *
 * <h2>Pourquoi ce module</h2>
 * Les attributs d'une œuvre (mangaka, statut, nombre de tomes, jaquette,
 * identifiants externes) sont recopiés d'un fournisseur AU MOMENT DE L'AJOUT,
 * puis plus jamais : une série en cours gardait éternellement le nombre de
 * tomes qu'elle avait le jour où on l'a ajoutée, et une fiche ajoutée à la
 * main n'avait rien du tout. Il n'existait aucun moyen de les redemander
 * (demande utilisateur du 2026-08-27 : « je veux un bouton pour recharger les
 * images ou les infos api »).
 *
 * <h2>Deux fonctions pures, testables à l'œil</h2>
 * Le choix du candidat et le calcul de ce qu'il faut écrire vivent ici, hors
 * de React et hors du réseau - ce sont les deux endroits où une erreur
 * écraserait des données de l'utilisateur.
 */

/** L'œuvre telle qu'on en a besoin ici - jamais la réponse entière. */
export interface OeuvreARecharger {
  title: string
  attributes: Record<string, unknown>
  /** Les clés saisies à la main (Lot 130) - jamais réécrites. Le serveur
   *  applique la même règle ; ici elle sert au décompte rendu à l'écran. */
  champsSaisis?: string[]
}

/** Les clés sous lesquelles vit l'identifiant du fournisseur, selon le type de
 * collection (voir EntityInfoSection.TECHNICAL_KEYS). */
const CLES_IDENTIFIANT = ['malId', 'igdbId', 'bggId']

/** Jamais rechargée : c'est la remarque de l'utilisateur, pas une donnée de
 * source. Le sac d'attributs mélange les deux (voir EntityDetailPage). */
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
 * Lequel de ces candidats EST cette œuvre ?
 *
 * L'identifiant du fournisseur d'abord (malId/igdbId/bggId, déjà stocké depuis
 * l'ajout) : c'est le seul rapprochement sûr. À défaut, le titre exact, aux
 * accents et à la casse près - jamais un « à peu près », qui recopierait
 * tranquillement les informations d'un spin-off sur la série mère.
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
 * Ce qu'il faut écrire, et RIEN de plus.
 *
 * <p>Seules les clés que la source renseigne vraiment, et seulement quand
 * leur valeur diffère de celle déjà en base : le décompte rendu à l'écran doit
 * pouvoir dire « tout est déjà à jour » sans mentir.
 *
 * <p><b>Trois exclusions.</b> Les clés SAISIES À LA MAIN (Lot 130 : « si on
 * recharge depuis l'api alors on écrase les infos non déjà éditées »). Les
 * remarques de l'utilisateur, qui ne viennent d'aucune source. Et la jaquette
 * de la série, qui n'est POSÉE QUE SI ELLE MANQUE : elle se choisit à la main
 * sur la fiche (voir le contrôle de couverture), et un rechargement n'a pas à
 * défaire ce choix.
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
