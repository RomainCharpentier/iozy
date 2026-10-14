package com.iozycore.core.testing;

import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link ExperienceRepository}, for application tests without Spring. */
public class InMemoryExperienceRepository implements ExperienceRepository {

    private final Map<UUID, Experience> store = new LinkedHashMap<>();

    @Override
    public Experience save(Experience experience) {
        store.put(experience.id(), experience);
        return experience;
    }

    @Override
    public Optional<Experience> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<Experience> findByEntityId(UUID entityId) {
        return store.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
    }

    @Override
    public List<Experience> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public boolean existsByEntityId(UUID entityId) {
        return store.values().stream().anyMatch(e -> e.entityId().equals(entityId));
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }
}
