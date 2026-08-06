package com.iozycore.domain.shared;

import java.util.UUID;

/**
 * Levée lorsqu'on tente de supprimer une Entity alors que des Ownership
 * ou des Experience la référencent encore. Traduit l'invariant validé
 * en conception : une donnée ne disparaît jamais silencieusement.
 */
public class EntityDeletionNotAllowedException extends RuntimeException {

    public EntityDeletionNotAllowedException(UUID entityId, long ownershipCount, long experienceCount) {
        super("Impossible de supprimer l'entité %s : %d ownership(s) et %d expérience(s) la référencent encore"
                .formatted(entityId, ownershipCount, experienceCount));
    }
}
