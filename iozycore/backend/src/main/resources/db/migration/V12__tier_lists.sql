-- V12__tier_lists.sql
-- Tier Lists (voir com.iozycore.domain.tierlist) - deux mécanismes
-- distincts :
--   - entity_rank : classement GÉNÉRAL, une ligne = une oeuvre classée sur
--     l'échelle complète S-F. Absence de ligne = "non classé", jamais un
--     rang null stocké (voir EntityRank.java).
--   - tier_list / tier_list_item : classements PERSONNALISÉS, nommés,
--     rattachés à un seul univers (entity_type_id), rangs actifs
--     configurables. L'appartenance à une tier_list est toujours explicite
--     (tier_list_item peut exister avec rank NULL = ajouté mais pas encore
--     classé, "non classé" au sein de CETTE liste).
CREATE TABLE entity_rank (
    entity_id   UUID PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL,
    rank        VARCHAR(1) NOT NULL,
    ranked_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE tier_list (
    id              UUID PRIMARY KEY,
    owner_id        UUID NOT NULL,
    name            VARCHAR(255) NOT NULL,
    entity_type_id  UUID NOT NULL REFERENCES entity_type(id),
    active_ranks    VARCHAR(32) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_tier_list_entity_type ON tier_list(entity_type_id);

-- Id propre plutôt qu'une clé composite (tier_list_id, entity_id) - même
-- convention que "relationship" (voir V1__init_schema.sql), l'unicité de
-- l'appartenance est portée par la contrainte UNIQUE ci-dessous, pas par la
-- clé primaire.
CREATE TABLE tier_list_item (
    id              UUID PRIMARY KEY,
    tier_list_id    UUID NOT NULL REFERENCES tier_list(id) ON DELETE CASCADE,
    entity_id       UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    rank            VARCHAR(1),
    added_at        TIMESTAMPTZ NOT NULL,
    UNIQUE (tier_list_id, entity_id)
);

CREATE INDEX idx_tier_list_item_entity ON tier_list_item(entity_id);
