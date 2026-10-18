-- V3__volume_search_cache.sql
-- Stocke durablement le résultat de la recherche de tomes/éditions (Google
-- Books, 8 requêtes en parallèle - voir GoogleBooksVolumeSearchProvider) :
-- contrairement au TtlCache en mémoire (perdu à chaque redémarrage du
-- backend), cette table survit aux redéploiements. Une fois un résultat
-- stocké, il n'est plus jamais rappelé automatiquement (voir
-- MetadataSearchService.searchVolumes) - seul un rafraîchissement manuel
-- explicite (bouton "Actualiser" côté client) déclenche un nouvel appel
-- Google Books et met à jour la ligne correspondante.
CREATE TABLE volume_search_cache (
    id              UUID PRIMARY KEY,
    entity_type_id  UUID NOT NULL REFERENCES entity_type(id),
    -- Titre/auteur normalisés (trim + minuscules, même règle que
    -- MetadataSearchService.normalize) : ce ne sont que des clés de cache,
    -- jamais affichés tels quels.
    series_title    VARCHAR(512) NOT NULL,
    author          VARCHAR(512) NOT NULL DEFAULT '',
    volumes         JSONB NOT NULL DEFAULT '[]'::JSONB,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_type_id, series_title, author)
);
