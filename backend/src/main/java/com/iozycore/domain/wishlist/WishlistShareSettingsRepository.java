package com.iozycore.domain.wishlist;

import java.util.Optional;

/** Port for the single, mono-user {@link WishlistShareSettings} row (see {@link com.iozycore.domain.shared.DefaultOwner}). */
public interface WishlistShareSettingsRepository {

    /** Returns {@link WishlistShareSettings#noLink()} the first time, before any explicit save. */
    WishlistShareSettings find();

    WishlistShareSettings save(WishlistShareSettings settings);

    /** Résolution du lien public - {@link Optional#empty()} si aucun lien actif ne correspond à ce jeton
     * (jeton inconnu ou lien supprimé depuis) : le contrôleur public répond alors 404, jamais un détail
     * qui laisserait deviner si le jeton a existé un jour. */
    Optional<WishlistShareSettings> findByToken(String token);
}
