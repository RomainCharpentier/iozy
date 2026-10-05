package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;

/**
 * Extension point of the core: a universe offers its discoveries.
 *
 * <p>Discovering guesses nothing, it relies on a signal specific to each
 * collection type - similar games at IGDB for video games, same
 * author for mangas, common categories for board games. The
 * core knows none of these signals: it asks the source that
 * {@link #supports covers} the type (Batch 133 - one module per universe, the
 * core depends on none of them).
 */
public interface DiscoverySource {

    boolean supports(EntityType entityType);

    /** The suggestions for this type - never what is already owned, never an outage disguised as an empty list. */
    List<DiscoveryCandidate> discover(EntityType entityType);
}
