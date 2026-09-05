-- V14__collection_share.sql
-- "Partager ma collection" (voir com.iozycore.core.domain.collectionshare.
-- CollectionShareSettings) - ligne mono-utilisateur (owner_id =
-- DefaultOwner.ID), même patron que wishlist_share_settings (V7).
-- token NULL = pas de lien actif.
--
-- Table SÉPARÉE de wishlist_share_settings, jamais une colonne de plus sur
-- celle-ci : les deux liens doivent pouvoir être révoqués indépendamment.
CREATE TABLE collection_share_settings (
    owner_id           UUID PRIMARY KEY,
    token              VARCHAR(255) UNIQUE,
    include_tier_lists BOOLEAN NOT NULL DEFAULT FALSE
);
