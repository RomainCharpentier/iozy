package com.iozycore.core.domain.work;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * The elements of one work, as its universe sees them.
 *
 * @param entityId   the work
 * @param elements   in display order
 * @param totalCount how many elements the work has in all, or {@code null} when nobody
 *                   knows: an unknown total stays unknown, it is never guessed from what is owned
 * @param origin     where derived elements come from (a provider, or its fallback), or {@code null} when the
 *                   elements are only what the catalog holds
 */
public record WorkElements(UUID entityId, List<WorkElement> elements, Integer totalCount, WorkElementsOrigin origin) {

    public WorkElements {
        Objects.requireNonNull(entityId, "entityId");
        elements = List.copyOf(elements);
    }

    /**
     * The total of a list of elements: those that are not optional. An optional element
     * (an expansion, another game of a licence the collector does not follow) is shown, but
     * a collector who owns Catan alone owns all of what he follows: 1 of 1, not 1 of 31.
     */
    public static int followedCount(List<WorkElement> elements) {
        return (int) elements.stream().filter(element -> !element.optional()).count();
    }

    /** Elements read from the catalog alone. */
    public WorkElements(UUID entityId, List<WorkElement> elements, Integer totalCount) {
        this(entityId, elements, totalCount, null);
    }
}
