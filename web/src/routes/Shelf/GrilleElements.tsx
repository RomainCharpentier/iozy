import { useNavigate } from 'react-router-dom'
import { CoverTile } from '../../components/CoverTile'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { trierTypes } from './shelfTiles'
import type { TuileElement } from './shelfTiles'
import type { EntityTypeDto } from '../../types/api'

/**
 * La vue DÉGROUPÉE : les éléments eux-mêmes, sans le détour par leur groupe.
 *
 * <h2>Dégrouper délie les GROUPES, pas les TYPES</h2>
 * Première version : une seule grille, tous types confondus. Sur une
 * collection de onze tomes de manga et d'un jeu vidéo, le jeu disparaissait -
 * « on voit plus que les mangas quand on dégroupe ». Il était pourtant bien
 * là, en quatrième position ; c'est la structure qui manquait. Un type peu
 * fourni se noie dès qu'un autre en apporte cinquante.
 *
 * <p>La page promet une section par catégorie depuis le Lot 3, et dégrouper
 * ne doit pas revenir dessus : ce qui change, c'est le CONTENU d'une section
 * (des éléments au lieu de groupes), pas son existence. L'ordre des types est
 * le même que dans la vue groupée (voir trierTypes) - basculer d'une vue à
 * l'autre ne doit pas rebattre les univers.
 *
 * <h2>Élément, et non tome</h2>
 * Ce qu'un groupe contient dépend du type : des tomes pour un manga, l'œuvre
 * elle-même pour un jeu vidéo ou un jeu de société, autre chose demain. Cette
 * grille ne suppose rien de tout ça - elle affiche ce que l'aplatissement lui
 * donne (voir aplatirEnElements).
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

  const sections = trierTypes([...typesParId.values()])
    .map((entityType) => ({ entityType, tuiles: tuiles.filter((t) => t.entityTypeId === entityType.id) }))
    .filter((section) => section.tuiles.length > 0)

  // Un seul type à l'écran : l'annoncer répéterait le titre de la page (vue
  // d'une catégorie) ou n'apprendrait rien. L'en-tête n'existe que là où il
  // sépare vraiment quelque chose.
  const avecEnTetes = sections.length > 1

  return (
    <div className="flex flex-col gap-6">
      {sections.map(({ entityType, tuiles: duType }) => {
        const visual = getEntityTypeVisual(entityType)
        return (
          <section key={entityType.id} className="flex flex-col gap-3">
            {avecEnTetes && (
              <h2 className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: visual.color }} />
                <span className="font-display text-[15px] font-semibold text-textPrimary">{entityType.label}</span>
                <span className="text-[13px] text-faint">{duType.length}</span>
              </h2>
            )}
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {duType.map((tuile) => (
                <li key={tuile.key}>
                  <CoverTile
                    title={tuile.title}
                    subtitle={tuile.subtitle}
                    imageUrl={tuile.imageUrl}
                    gradientKey={tuile.gradientKey}
                    aspectClassName={visual.aspectClassName}
                    signal={tuile.signal}
                    onClick={() => navigate(`/entity/${tuile.entityId}`)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
