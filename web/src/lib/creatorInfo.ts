/**
 * Ligne "auteur/créateur" d'une fiche ou d'une confirmation d'ajout - un seul
 * concept affiché différemment selon le type (voir "vision UX" fournie par
 * l'utilisateur : chaque type a ses métadonnées essentielles propres, jamais
 * les mêmes champs forcés partout). `mangaka` (Manga, Jikan/MyAnimeList) et
 * `studio` (Jeu vidéo, IGDB - voir IgdbMetadataProvider côté backend) sont
 * déjà des attributs réels aujourd'hui ; aucun attribut équivalent n'existe
 * encore pour Jeu de société (BggMetadataProvider ne renvoie ni auteur ni
 * éditeur) - pas ajouté ici tant qu'aucune donnée réelle ne l'alimenterait
 * (voir "ne pas anticiper trop loin").
 */
export function creatorFrom(attributes: Record<string, unknown> | undefined): string | null {
  const mangaka = attributes?.mangaka
  if (typeof mangaka === 'string' && mangaka.length > 0) return mangaka
  const studio = attributes?.studio
  if (typeof studio === 'string' && studio.length > 0) return studio
  return null
}
