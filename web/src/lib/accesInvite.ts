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
 * Un écran est réservé aux comptes quand son SUJET est d'écrire ou de se
 * gérer : ajouter à sa collection, scanner, analyser une annonce, importer,
 * déclarer les catégories de l'instance, régler son compte. Tout ce qui se
 * contente de MONTRER la collection reste ouvert - c'est exactement ce qu'un
 * visiteur est venu voir : les œuvres, les fiches, les classements, les
 * statistiques, le bilan.
 */
const RESERVEES_AUX_COMPTES = [
  // Écrire dans la collection.
  '/add',
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
]

/**
 * Compare par préfixe de SEGMENT : `/types` couvre `/types/new`, sans jamais
 * attraper un `/typesomething` qui n'aurait rien à voir.
 */
export function estReserveeAuxComptes(chemin: string): boolean {
  return RESERVEES_AUX_COMPTES.some((route) => chemin === route || chemin.startsWith(`${route}/`))
}
