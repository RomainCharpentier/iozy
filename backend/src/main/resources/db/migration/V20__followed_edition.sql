-- V20__followed_edition.sql
-- « L'édition que je suis » pour une série - voir
-- com.iozycore.core.domain.followededition, et le badge SUIVIE de la maquette
-- « Fiche série - Naruto (multi-éditions) ».
--
-- Pourquoi une donnée persistée et non un simple état d'écran : jusqu'ici,
-- l'édition affichée sur la fiche d'une série était un `useState` du composant
-- web. Rouvrir la fiche repartait toujours sur la première édition trouvée, et
-- l'information « c'est CELLE-CI que je collectionne » n'existait nulle part -
-- alors qu'elle est un fait de collection au même titre qu'une possession :
-- elle décide de la progression qu'on veut voir, de l'édition qu'une analyse
-- d'achat doit comparer, et de celle qu'on cherche à compléter.
--
-- L'édition est désignée par son NOM et non par l'id d'une MangaEdition :
-- une série peut avoir des tomes dans une édition dont aucune fiche
-- MangaEdition n'a encore été créée (elle n'est créée que lorsqu'on renseigne
-- éditeur/nombre de tomes). Suivre une édition ne doit pas exiger de l'avoir
-- d'abord documentée. Même choix que EditionUpgradeWish.current_edition_name.
CREATE TABLE followed_edition (
    id            UUID PRIMARY KEY,
    entity_id     UUID NOT NULL REFERENCES entity(id),
    owner_id      UUID NOT NULL,
    edition_name  VARCHAR(255) NOT NULL,
    followed_at   DATE NOT NULL,
    -- Une seule édition suivie par série et par propriétaire : « suivre »
    -- désigne celle qu'on collectionne, pas une liste de favoris. La règle
    -- est tenue par la base plutôt que par le code appelant, pour qu'aucun
    -- chemin d'écriture ne puisse en laisser deux.
    CONSTRAINT followed_edition_unique_par_serie UNIQUE (entity_id, owner_id)
);
