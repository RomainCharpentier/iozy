-- V17__unified_share.sql
-- Partage unifié : UNE ligne, UN jeton, plusieurs sections visibles.
--
-- Remplace collection_share_settings (V14) et wishlist_share_settings (V7),
-- qui étaient deux systèmes parallèles avec chacun son jeton, son contrôleur
-- public et sa page. Ma collection et mes envies sont deux vues du même
-- espace personnel, pas deux espaces : elles se partagent donc ensemble ou
-- séparément, mais par le même lien.
--
-- Aucune donnée à migrer : les deux tables ne contenaient que la ligne
-- mono-utilisateur avec token NULL, c'est-à-dire qu'aucun lien n'avait jamais
-- été généré. Rien de distribué ne casse, et garder une couche de
-- compatibilité pour des jetons qui n'existent pas n'aurait servi à rien
-- (voir docs/USER_JOURNEYS.md, parcours 53).
--
-- token NULL = aucun lien actif, même convention qu'avant : un jeton révoqué
-- disparaît au lieu de rester sur une ligne « désactivée ».
CREATE TABLE share_settings (
    owner_id           UUID PRIMARY KEY,
    token              VARCHAR(255) UNIQUE,
    share_collection   BOOLEAN NOT NULL DEFAULT TRUE,
    share_wishlist     BOOLEAN NOT NULL DEFAULT TRUE,
    include_tier_lists BOOLEAN NOT NULL DEFAULT FALSE,
    -- Un lien actif expose au moins une section : un lien vers une page vide
    -- n'est pas un partage discret, c'est une URL qui ne sert à rien. Écrit
    -- ici en plus du domaine, pour que la base ne puisse pas porter cet état.
    CONSTRAINT share_settings_at_least_one_section
        CHECK (token IS NULL OR share_collection OR share_wishlist)
);

DROP TABLE collection_share_settings;
DROP TABLE wishlist_share_settings;
