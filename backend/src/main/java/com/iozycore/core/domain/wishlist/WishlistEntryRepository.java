package com.iozycore.core.domain.wishlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WishlistEntryRepository {

    WishlistEntry save(WishlistEntry entry);

    /** L'envie portant sur l'ŒUVRE entière (variantId vide) - types sans tome. */
    Optional<WishlistEntry> findByEntityId(UUID entityId);

    /** L'envie portant sur CE tome précis. */
    Optional<WishlistEntry> findByVariantId(UUID variantId);

    /** Toutes les envies d'une œuvre, tomes compris - ce que la fiche affiche. */
    List<WishlistEntry> findAllByEntityId(UUID entityId);

    /** Utilisé par le Bounded Context Insights (étape 8) pour calculer les statistiques. */
    List<WishlistEntry> findAll();

    /** Retire une entrée (voir le cycle de vie décrit sur {@link WishlistEntry}). Idempotent par contrat :
     * un id déjà supprimé ou inconnu n'est jamais une erreur, jamais une exception - seul l'état "cette
     * entrée n'est plus dans la wishlist" compte, qu'elle vienne d'être supprimée ou qu'elle l'ait déjà
     * été (double clic, tuile obsolète après un rechargement tardif, etc.). N'affecte jamais l'Entity,
     * la MangaEdition, le Variant ou l'Ownership visés par cette entrée - WishlistEntry ne porte qu'un
     * entityId en simple valeur, sans relation JPA, donc aucune cascade possible côté catalogue/collection. */
    void deleteById(UUID id);
}
