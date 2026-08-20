package com.iozycore.domain.collectionshare;

import java.util.Optional;

/** Port de persistance du lien de partage de collection - ligne unique
 * mono-utilisateur (voir CollectionShareSettings), même forme que
 * WishlistShareSettingsRepository. */
public interface CollectionShareSettingsRepository {

    /** État courant - jamais vide : "aucun lien" est un état, pas une absence de ligne. */
    CollectionShareSettings find();

    CollectionShareSettings save(CollectionShareSettings settings);

    /** Vide si le jeton ne correspond à aucun lien ACTIF (voir PublicCollectionController). */
    Optional<CollectionShareSettings> findByToken(String token);
}
