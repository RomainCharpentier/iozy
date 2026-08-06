-- V1__init_schema.sql
-- Schéma initial d'IozyCore, correspondant au modèle de données validé (étape 9)
-- et à l'ERD. entity.attributes est en JSONB pour ne nécessiter aucune
-- migration de schéma lors du passage aux types dynamiques (V2).

CREATE TABLE entity_type (
    id              UUID PRIMARY KEY,
    code            VARCHAR(64) NOT NULL UNIQUE,
    label           VARCHAR(128) NOT NULL,
    schema          JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE entity (
    id              UUID PRIMARY KEY,
    entity_type_id  UUID NOT NULL REFERENCES entity_type(id),
    title           VARCHAR(512) NOT NULL,
    attributes      JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_type_id ON entity(entity_type_id);
CREATE INDEX idx_entity_attributes_gin ON entity USING GIN (attributes);

CREATE TABLE variant (
    id              UUID PRIMARY KEY,
    entity_id       UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    label           VARCHAR(256) NOT NULL,
    attributes      JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX idx_variant_entity_id ON variant(entity_id);

CREATE TABLE ownership (
    id              UUID PRIMARY KEY,
    entity_id       UUID NOT NULL REFERENCES entity(id),
    variant_id      UUID REFERENCES variant(id),
    condition       VARCHAR(16) NOT NULL,
    status          VARCHAR(16) NOT NULL,
    acquired_at     DATE NOT NULL,
    note            TEXT
);

CREATE INDEX idx_ownership_entity_id ON ownership(entity_id);

CREATE TABLE experience (
    id              UUID PRIMARY KEY,
    entity_id       UUID NOT NULL REFERENCES entity(id),
    experience_type VARCHAR(32) NOT NULL,
    occurred_at     DATE NOT NULL,
    rating          SMALLINT CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
    comment         TEXT
);

CREATE INDEX idx_experience_entity_id ON experience(entity_id);

CREATE TABLE wishlist_entry (
    id              UUID PRIMARY KEY,
    entity_id       UUID NOT NULL REFERENCES entity(id),
    added_at        DATE NOT NULL,
    UNIQUE (entity_id)
);

CREATE TABLE tag (
    id              UUID PRIMARY KEY,
    label           VARCHAR(128) NOT NULL UNIQUE
);

CREATE TABLE entity_tag (
    entity_id       UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (entity_id, tag_id)
);

CREATE TABLE relationship (
    id                  UUID PRIMARY KEY,
    source_entity_id    UUID NOT NULL REFERENCES entity(id),
    target_entity_id    UUID NOT NULL REFERENCES entity(id),
    relationship_type   VARCHAR(64) NOT NULL,
    CHECK (source_entity_id <> target_entity_id)
);

CREATE INDEX idx_relationship_source ON relationship(source_entity_id);
CREATE INDEX idx_relationship_target ON relationship(target_entity_id);

-- Les 3 EntityType du MVP (Manga, Jeu vidéo, Jeu de société), UUID alignés
-- sur les constantes codées en dur dans EntityType.java (étape 18, MVP).
INSERT INTO entity_type (id, code, label, schema) VALUES
    ('00000000-0000-0000-0000-000000000001', 'MANGA', 'Manga',
        '{"customFieldKeys": ["mangaka", "publisher", "volumeNumber", "seriesStatus"], "allowedExperienceTypes": ["READ", "IN_PROGRESS", "ABANDONED"]}'),
    ('00000000-0000-0000-0000-000000000002', 'VIDEO_GAME', 'Jeu vidéo',
        '{"customFieldKeys": ["platform", "studio", "averageDurationHours"], "allowedExperienceTypes": ["FINISHED", "IN_PROGRESS", "ABANDONED"]}'),
    ('00000000-0000-0000-0000-000000000003', 'BOARD_GAME', 'Jeu de société',
        '{"customFieldKeys": ["minPlayers", "maxPlayers", "averageDurationMinutes"], "allowedExperienceTypes": ["PLAYED"]}');
