/**
 * D'où l'on vient en arrivant sur une fiche, quand ça vaut la peine de
 * proposer d'y retourner.
 *
 * <h2>Pourquoi par `location.state`, alors que le reste n'en dépend plus</h2>
 * Le Lot 29 a retiré tout `location.state` de la fiche, et pour une bonne
 * raison : l'ancien écran d'ajout n'existait QUE par lui, donc un F5 le vidait
 * et un lien partagé ne menait nulle part. Ici, c'est l'inverse — cet état ne
 * porte aucune donnée, seulement une commodité. S'il manque (fiche rechargée,
 * lien reçu, arrivée depuis la collection), le lien de retour ne s'affiche
 * tout simplement pas, et la page reste entière. C'est la différence entre un
 * écran qui DÉPEND d'un état volatile et un écran qui SAIT s'en passer.
 *
 * <h2>Pourquoi pas un simple `navigate(-1)`</h2>
 * Parce qu'un « Retour » sans destination ment une fois sur deux : ouvrir une
 * fiche depuis la recherche puis en ouvrir une autre depuis ses relations
 * ramènerait à la fiche précédente, pas à la recherche. Nommer la destination,
 * c'est promettre exactement ce qu'on tient - et le bouton Précédent du
 * navigateur continue de faire son travail à côté.
 */
export interface RetourFiche {
  /** La route à rouvrir - `/add`, `/scan`… */
  to: string
  /** Ce que le lien annonce. Le nom de l'écran, jamais « Retour » seul. */
  libelle: string
}

export interface EtatFiche {
  retour?: RetourFiche
}

/** Lit l'origine d'une navigation sans jamais faire confiance à sa forme :
 *  `location.state` est un sac libre, qu'un lien forgé ou une version
 *  antérieure de l'app peut remplir autrement. */
export function retourDepuis(state: unknown): RetourFiche | null {
  if (!state || typeof state !== 'object') return null
  const retour = (state as EtatFiche).retour
  if (!retour || typeof retour.to !== 'string' || typeof retour.libelle !== 'string') return null
  // Une route interne, jamais une URL absolue : ce lien ne doit pas pouvoir
  // devenir une redirection vers l'extérieur.
  if (!retour.to.startsWith('/') || retour.to.startsWith('//')) return null
  return retour
}
