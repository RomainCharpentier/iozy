package com.iozycore.core.domain.shared;

import java.util.UUID;

/**
 * Thrown when someone tries to delete an EntityType while Entities
 * still use it. Same invariant as {@link EntityDeletionNotAllowedException}
 * applied to the type rather than the instance: a category never disappears
 * silently as long as data is attached to it.
 */
public class EntityTypeDeletionNotAllowedException extends RuntimeException {

    public EntityTypeDeletionNotAllowedException(UUID entityTypeId, long entityCount) {
        super("Impossible de supprimer le type %s : %d entité(s) l'utilisent encore"
                .formatted(entityTypeId, entityCount));
    }
}
