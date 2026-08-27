import { useNavigate } from 'react-router-dom'
import { CoverTile } from '../../components/CoverTile'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import type { TuileElement } from './shelfTiles'
import type { EntityTypeDto } from '../../types/api'

/**
 * La vue DÉGROUPÉE : les éléments eux-mêmes, sans le détour par leur groupe.
 *
 * <h2>Élément, et non tome</h2>
 * Ce qu'un groupe contient dépend du type de collection : des tomes pour un
 * manga, l'œuvre elle-même pour un jeu vidéo ou un jeu de société, autre
 * chose demain. Cette grille ne suppose rien de tout ça - elle affiche ce que
 * l'aplatissement lui donne (voir aplatirEnElements).
 *
 * <h2>Pourquoi une grille et non des rails</h2>
 * Les rails de la vue groupée existent pour ranger des groupes par type. Ici
 * il n'y a plus de groupe : une seule grille répond mieux à « montre-moi tout
 * ce que j'ai » qu'un rail par type qu'il faudrait faire défiler séparément.
 * Le type reste lisible sur chaque tuile (son badge), et c'est lui qui décide
 * du format de jaquette.
 *
 * <p>Cliquer un élément ouvre la fiche de son œuvre : il n'a pas d'écran à
 * lui, et c'est la fiche qui porte tout ce qu'on peut en faire.
 */
export function GrilleElements({
  tuiles,
  typesParId,
}: {
  tuiles: TuileElement[]
  typesParId: Map<string, EntityTypeDto>
}) {
  const navigate = useNavigate()

  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {tuiles.map((tuile) => (
        <li key={tuile.key}>
          <CoverTile
            title={tuile.title}
            subtitle={tuile.subtitle}
            typeLabel={tuile.typeLabel}
            imageUrl={tuile.imageUrl}
            gradientKey={tuile.gradientKey}
            aspectClassName={getEntityTypeVisual(typesParId.get(tuile.entityTypeId)).aspectClassName}
            signal={tuile.signal}
            onClick={() => navigate(`/entity/${tuile.entityId}`)}
          />
        </li>
      ))}
    </ul>
  )
}
