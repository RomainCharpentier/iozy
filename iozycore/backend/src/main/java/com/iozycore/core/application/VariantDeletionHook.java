package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.Variant;

import java.util.UUID;

/**
 * Extension point of the core: what a universe does AFTER the deletion
 * of a volume - the manga module deletes the reference edition that became
 * orphan, if no recorded price holds it (Batch 133).
 */
public interface VariantDeletionHook {

    /** The work already saved without the volume; the volume as it was. */
    void apresSuppression(Entity oeuvre, Variant tomeSupprime, UUID tomeSupprimeId);
}
