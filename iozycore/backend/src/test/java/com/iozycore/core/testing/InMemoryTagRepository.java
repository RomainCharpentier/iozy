package com.iozycore.core.testing;

import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link TagRepository}, for application tests without Spring. */
public class InMemoryTagRepository implements TagRepository {

    private final Map<UUID, Tag> store = new LinkedHashMap<>();

    @Override
    public Tag save(Tag tag) {
        store.put(tag.id(), tag);
        return tag;
    }

    @Override
    public Optional<Tag> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<Tag> findByLabel(String label) {
        return store.values().stream().filter(t -> t.label().equals(label)).findFirst();
    }

    @Override
    public List<Tag> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public void supprimer(UUID id) {
        store.remove(id);
    }
}
