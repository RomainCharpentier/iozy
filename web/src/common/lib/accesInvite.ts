/**
 * Ce qu'une visite sans compte n'a pas à atteindre.
 *
 * <h2>Une seule liste, lue par tout ce qui mène quelque part</h2>
 * Le routage s'en sert pour renvoyer un visiteur à l'accueil, les deux barres
 * de navigation pour ne pas afficher une entrée qui rebondirait, les raccourcis
 * d'en-tête pour la même raison. Écrite trois fois, elle aurait divergé au
 * premier écran ajouté - et la divergence aurait pris la forme d'un onglet qui
 * renvoie chez soi sans rien dire.
 *
 * <h2>Ce n'est PAS une protection</h2>
 * La protection est côté serveur, et elle est totale : une session de visite
 * n'écrit rien, quelle que soit la route (voir SecurityConfig). Ceci ne fait
 * qu'éviter de proposer des portes qui ne mènent nulle part - un écran d'ajout
 * dont chaque bouton refuse, une administration qui répond 403 à sa propre
 * lecture.
 *
 * <h2>La règle qui a servi à trancher</h2>
 * Un écran est réservé aux comptes quand son sujet est d'<b>écrire</b>, de se
 * <b>gérer</b>, ou de <b>calculer sur une collection</b>. Ce qu'un visiteur
 * consulte, c'est le catalogue : les œuvres et leurs fiches. Tout le reste -
 * progression, statistiques, bilan, classements, envies - se dérive de ce que
 * quelqu'un possède, et une session de visite ne possède rien : ces écrans
 * s'afficheraient vides, ce qui se lit comme une panne plutôt que comme une
 * réponse.
 */
const RESERVEES_AUX_COMPTES = [
  // « Ma collection » est un espace PERSONNEL : elle ne montre que ce qu'on
  // possède ou souhaite (voir correspondAuFiltre), donc elle serait vide pour
  // un visiteur - et intitulée « Ma », ce qui ne veut rien dire pour lui. Son
  // équivalent consultable est le catalogue, à `/add`, qui reste ouvert.
  '/',
  // Écrire dans la collection. `/add` n'y est plus : c'est devenu l'entrée du
  // CATALOGUE, et les gestes d'ajout qu'il porte encore sont masqués à un
  // visiteur écran par écran (voir SearchPage).
  '/scan',
  '/apercu',
  '/import-bgg',
  // Analyser une annonce : chaque étape est un POST, dont certains sortent
  // chez un fournisseur ou chez un modèle. Une porte ouverte à tout Internet
  // n'a pas à offrir ça.
  '/purchase-analysis',
  // L'outillage de l'instance et du catalogue partagé.
  '/administration',
  '/types',
  '/editions',
  // Son propre compte - ce qu'un visiteur n'a pas.
  '/profile',
  '/settings',
  // Et tout ce qui se CALCULE sur une collection : progression, découvertes,
  // statistiques, bilan, classements, envies. Une session de visite ne nomme
  // aucun propriétaire (voir Invite côté serveur), donc ces écrans seraient
  // exacts et vides - des zéros et des listes sans rien, qui se lisent comme
  // une panne plutôt que comme une réponse.
  '/discover',
  '/tier-lists',
  '/stats',
  '/recap',
  '/suggestions',
  '/wishlist',
]

/**
 * Compare par préfixe de SEGMENT : `/types` couvre `/types/new`, sans jamais
 * attraper un `/typesomething` qui n'aurait rien à voir.
 */
export function estReserveeAuxComptes(chemin: string): boolean {
  return RESERVEES_AUX_COMPTES.some((route) => chemin === route || chemin.startsWith(`${route}/`))
}
