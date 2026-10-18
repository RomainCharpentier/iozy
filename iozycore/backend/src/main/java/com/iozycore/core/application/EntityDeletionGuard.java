package com.iozycore.core.application;

import java.util.UUID;

/**
 * Extension point of the core: what, in a universe, still holds
 * a work that we want to delete.
 *
 * <p>The core counts ownerships and experiences; the reference editions
 * of a manga live in their module and are counted here (Batch 133).
 */
public interface EntityDeletionGuard {

    /** How many things of this universe still reference this work - zero if nothing holds it. */
    long referencesRestantes(UUID entityId);
}
