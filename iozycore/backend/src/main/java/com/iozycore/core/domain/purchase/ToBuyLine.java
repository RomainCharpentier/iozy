package com.iozycore.core.domain.purchase;

import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;

import java.util.List;
import java.util.UUID;

/**
 * One line of the "to buy" list: what to buy next for one work.
 *
 * @param kind        why it is there (see {@link Kind})
 * @param elements    what the line is about, in display order; "Je l'ai" takes the first one
 * @param releaseDate the release ahead for an {@link Kind#UPCOMING} line, {@code null} otherwise
 */
public record ToBuyLine(UUID entityId, UUID entityTypeId, String title, String coverImageUrl, Kind kind,
                        CollectorStatus collectorStatus, List<WorkElement> elements, ReleaseDate releaseDate) {

    public enum Kind {
        /** Announced, not out yet: a pre-order, the next volume of an ongoing series. */
        UPCOMING,
        /** Published and missing from an ongoing work: what completes it. */
        COMPLETE,
        /** Only wishes: the collector asked for these elements. */
        WISH
    }

    public ToBuyLine {
        elements = List.copyOf(elements);
        if (elements.isEmpty()) {
            throw new IllegalArgumentException("A line to buy names at least one element");
        }
    }
}
