package com.iozycore.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TagRepository {

    Tag save(Tag tag);

    Optional<Tag> findById(UUID id);

    Optional<Tag> findByLabel(String label);

    List<Tag> findAll();

    /**
     * Retire le tag lui-même. Les œuvres qui le portaient le perdent par la
     * clé étrangère ({@code ON DELETE CASCADE} sur {@code entity_tag}) : un
     * tag supprimé ne laisse pas de rattachement orphelin, et aucune œuvre
     * n'est touchée par ailleurs.
     */
    void supprimer(UUID id);
}
