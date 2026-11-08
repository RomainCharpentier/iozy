package com.iozycore.core.application.work;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;

import java.util.List;

/**
 * Extension point of the core: what a work is made of - the volumes of a
 * series, the expansions of a board game, the game itself.
 *
 * <p>The core knows no universe. It asks the one that {@link #supports covers}
 * the type, with everything already read for all the works of that type
 * ({@link WorkElementsContext}): one call per type, never one per work. A type
 * that nobody covers - every custom type - gets the core default
 * ({@link com.iozycore.core.domain.work.DefaultWorkElements}): its variants, or
 * the work itself.
 *
 * <p>A source says what the elements ARE (owned, wanted, announced, missing) and
 * the total when it knows it. It never applies the collector status: counting is
 * the core's job, the same for every type.
 */
public interface WorkElementsSource {

    boolean supports(EntityType entityType);

    /** One answer per work of the context; a work left out gets the core default. */
    List<WorkElements> elementsOf(WorkElementsContext context);
}
