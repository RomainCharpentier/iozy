package com.iozycore.core.insights;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Extension point of the core: the progress "X volumes owned out of Y" of a
 * work, as a universe can compute it - for a manga, from
 * its reference editions (Batch 133). The core displays it (detail page, sharing,
 * statistics, AI question) without knowing where the totals come from.
 */
public interface SeriesProgressSource {

    List<CollectionProgress> computeAll();

    Optional<CollectionProgress> compute(UUID entityId);
}
