package com.iozycore.core.domain.share;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * "Mes 4 incontournables" (lot 217): the works the owner puts first, and big,
 * on the public page - in the order chosen.
 *
 * <p>Four at most: the page shows them side by side as the first thing a
 * visitor sees, and a fifth would make it a second shelf. An empty list is
 * valid: the page then opens on the collection itself.
 */
public record PinnedWorks(List<UUID> entityIds) {

    public static final int MAX = 4;

    public PinnedWorks {
        Objects.requireNonNull(entityIds, "entityIds");
        if (entityIds.size() > MAX) {
            throw new IllegalArgumentException("Quatre incontournables au plus");
        }
        if (entityIds.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Une œuvre épinglée doit être désignée");
        }
        if (new HashSet<>(entityIds).size() != entityIds.size()) {
            throw new IllegalArgumentException("Une œuvre ne s'épingle qu'une fois");
        }
        entityIds = List.copyOf(entityIds);
    }

    public static PinnedWorks none() {
        return new PinnedWorks(List.of());
    }
}
