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
 */
public record WorkElements(UUID entityId, List<WorkElement> elements, Integer totalCount) {

    public WorkElements {
        Objects.requireNonNull(entityId, "entityId");
        elements = List.copyOf(elements);
    }
}
