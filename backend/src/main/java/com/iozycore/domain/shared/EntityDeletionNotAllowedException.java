package com.iozycore.domain.shared;

import java.util.UUID;

/**
 * Levée lorsqu'on tente de supprimer une Entity alors que des Ownership,
 * des Experience, ou une Édition catalogue (voir {@code MangaEdition.entityId},
 * modèle Série -> Édition -> Tome) la référencent encore. Traduit l'invariant
 * validé en conception : une donnée ne disparaît jamais silencieusement.
 */
public class EntityDeletionNotAllowedException extends RuntimeException {

    public EntityDeletionNotAllowedException(UUID entityId, long ownershipCount, long experienceCount, long editionCount) {
        super(("Impossible de supprimer l'entité %s : %d ownership(s), %d expérience(s) "
                + "et %d édition(s) catalogue la référencent encore")
                .formatted(entityId, ownershipCount, experienceCount, editionCount));
    }
}
