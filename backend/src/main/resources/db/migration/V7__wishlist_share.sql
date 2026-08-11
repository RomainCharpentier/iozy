-- V7__wishlist_share.sql
-- "Liste d'envies partageable" - un seul lien à la fois pour toute la
-- wishlist (voir com.iozycore.domain.wishlist.WishlistShareSettings).
-- Ligne mono-utilisateur (owner_id = DefaultOwner.ID), même patron que
-- collector_preferences. token NULL = pas de lien actif.
CREATE TABLE wishlist_share_settings (
    owner_id  UUID PRIMARY KEY,
    token     VARCHAR(255) UNIQUE
);
