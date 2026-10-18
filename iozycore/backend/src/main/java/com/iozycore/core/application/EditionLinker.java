package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;

import java.util.Optional;
import java.util.UUID;

/**
 * Extension point of the core: a universe that keeps REFERENCE EDITIONS
 * links a volume to its own.
 *
 * <p>The core knows that a volume carries an edition name ("Perfect Edition");
 * it does not know what an edition is. The manga module finds or
 * creates it, and returns its id - the volume is linked to it by id
 * only (see Variant.mangaEditionId), never by the class (Batch 133).
 */
public interface EditionLinker {

    /** The id of the edition of this work that carries this name, if this universe keeps one. */
    Optional<UUID> editionIdPour(Entity oeuvre, String nomEdition);
}
