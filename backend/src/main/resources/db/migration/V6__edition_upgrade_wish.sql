-- V6__edition_upgrade_wish.sql
-- "Je possède déjà cette série, mais je recherche une meilleure édition pour
-- la remplacer" (Perfect, Deluxe, Collector...) - voir
-- com.iozycore.core.domain.editionupgrade. Rattaché à l'Entity (la série), pas à
-- une Ownership précise : le remplacement vise toute la série dans son
-- édition actuelle.
CREATE TABLE edition_upgrade_wish (
    id                     UUID PRIMARY KEY,
    entity_id              UUID NOT NULL REFERENCES entity(id),
    owner_id               UUID NOT NULL,
    current_edition_name   VARCHAR(255) NOT NULL,
    desired_edition_name   VARCHAR(255),
    note                   TEXT,
    added_at               DATE NOT NULL
);
