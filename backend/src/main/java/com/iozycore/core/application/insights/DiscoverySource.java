package com.iozycore.core.application.insights;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.insights.Discovery;

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

    /**
     * The suggestions for this type - never what is already owned. Must never
     * throw because the source is silent: it says so in
     * {@link Discovery#sourceAnswered()} instead, so that an outage is never
     * shown as "nothing to offer".
     */
    Discovery discover(EntityType entityType);
}
