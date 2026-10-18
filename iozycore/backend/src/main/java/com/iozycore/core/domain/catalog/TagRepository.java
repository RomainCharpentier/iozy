package com.iozycore.core.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TagRepository {

    Tag save(Tag tag);

    Optional<Tag> findById(UUID id);

    Optional<Tag> findByLabel(String label);

    List<Tag> findAll();

    /**
     * Removes the tag itself. The works that carried it lose it through the
     * foreign key ({@code ON DELETE CASCADE} on {@code entity_tag}): a
     * deleted tag leaves no orphan link, and no work
     * is touched otherwise.
     */
    void supprimer(UUID id);
}
