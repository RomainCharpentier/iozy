package com.iozycore.manga.testing;

import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link MangaEditionRepository}, for application tests without Spring. */
public class InMemoryMangaEditionRepository implements MangaEditionRepository {

    private final Map<UUID, MangaEdition> store = new LinkedHashMap<>();

    @Override
    public MangaEdition save(MangaEdition edition) {
        store.put(edition.id(), edition);
        return edition;
    }

    @Override
    public Optional<MangaEdition> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName) {
        return store.values().stream()
                .filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle)
                        && e.editionName().equalsIgnoreCase(editionName))
                .findFirst();
    }

    @Override
    public List<MangaEdition> findBySeriesTitle(String seriesTitle) {
        return store.values().stream().filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle)).toList();
    }

    @Override
    public List<MangaEdition> findByEntityId(UUID entityId) {
        return store.values().stream().filter(e -> entityId.equals(e.entityId())).toList();
    }

    @Override
    public List<MangaEdition> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName) {
        return store.values().stream()
                .filter(e -> entityId.equals(e.entityId()) && e.editionName().equalsIgnoreCase(editionName))
                .findFirst();
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }

    public int count() {
        return store.size();
    }
}
