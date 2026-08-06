package com.iozycore.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TagRepository {

    Tag save(Tag tag);

    Optional<Tag> findById(UUID id);

    Optional<Tag> findByLabel(String label);

    List<Tag> findAll();
}
