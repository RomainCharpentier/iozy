package com.iozycore.domain.wishlist;

import com.iozycore.domain.shared.DefaultOwner;

import java.util.UUID;

/**
 * "Liste d'envies partageable" - un seul lien à la fois pour la wishlist
 * entière (pas d'auth réelle dans l'app, donc pas de notion d'invités
 * distincts à gérer). {@code token} nul = pas de lien actif : la
 * suppression du lien remet ce champ à null plutôt que de garder une ligne
 * "désactivée" - un jeton qui n'existe plus nulle part ne peut pas fuiter.
 * Régénérer le lien invalide silencieusement l'ancien (même mécanisme).
 */
public record WishlistShareSettings(UUID ownerId, String token) {

    public static WishlistShareSettings noLink() {
        return new WishlistShareSettings(DefaultOwner.ID, null);
    }

    public static WishlistShareSettings withNewToken() {
        return new WishlistShareSettings(DefaultOwner.ID, UUID.randomUUID().toString());
    }

    public boolean hasLink() {
        return token != null;
    }
}
