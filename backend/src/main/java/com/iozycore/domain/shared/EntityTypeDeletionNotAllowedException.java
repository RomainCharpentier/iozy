package com.iozycore.domain.shared;

import java.util.UUID;

/**
 * Levée lorsqu'on tente de supprimer un EntityType alors que des Entity
 * l'utilisent encore. Même invariant que {@link EntityDeletionNotAllowedException}
 * appliqué au type plutôt qu'à l'instance : une catégorie ne disparaît
 * jamais silencieusement tant que des données y sont rattachées.
 */
public class EntityTypeDeletionNotAllowedException extends RuntimeException {

    public EntityTypeDeletionNotAllowedException(UUID entityTypeId, long entityCount) {
        super("Impossible de supprimer le type %s : %d entité(s) l'utilisent encore"
                .formatted(entityTypeId, entityCount));
    }
}
