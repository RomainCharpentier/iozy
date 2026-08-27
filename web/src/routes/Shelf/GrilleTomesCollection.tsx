import { useNavigate } from 'react-router-dom'
import { CoverTile } from '../../components/CoverTile'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import type { TuileTome } from './shelfTiles'
import type { EntityTypeDto } from '../../types/api'

/**
 * La vue NON GROUPÉE : les tomes eux-mêmes, sans le détour par la série.
 *
 * <h2>Pourquoi une grille et non des rails</h2>
 * Les rails de la vue groupée existent pour ranger des groupes par type. Ici
 * il n'y a plus de groupe : « Possédés + non groupée » est une liste de tomes,
 * et une seule grille répond mieux à « montre-moi tout ce que j'ai » qu'un
 * rail par type qu'il faudrait faire défiler séparément. Le type reste lisible
 * sur chaque tuile (son badge), et c'est lui qui décide du format de jaquette.
 *
 * <p>Cliquer un tome ouvre la fiche de sa série - le tome n'a pas d'écran à
 * lui, et c'est bien la fiche qui porte tout ce qu'on peut en faire.
 */
export function GrilleTomesCollection({
  tuiles,
  typesParId,
}: {
  tuiles: TuileTome[]
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
