package com.iozycore.core.domain.shared;

import java.util.UUID;

/**
 * Thrown when someone tries to delete an Entity while Ownerships,
 * Experiences, or a catalog Edition (see {@code MangaEdition.entityId},
 * Series -> Edition -> Volume model) still reference it. Expresses the invariant
 * validated in design: data never disappears silently.
 */
public class EntityDeletionNotAllowedException extends RuntimeException {

    public EntityDeletionNotAllowedException(UUID entityId, long ownershipCount, long experienceCount, long editionCount) {
        super(("Impossible de supprimer l'entité %s : %d ownership(s), %d expérience(s) "
                + "et %d édition(s) catalogue la référencent encore")
                .formatted(entityId, ownershipCount, experienceCount, editionCount));
    }
}
