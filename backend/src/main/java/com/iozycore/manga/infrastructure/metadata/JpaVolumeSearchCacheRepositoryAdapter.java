package com.iozycore.manga.infrastructure.metadata;

import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@Transactional
public class JpaVolumeSearchCacheRepositoryAdapter implements VolumeSearchCacheRepository {

    private final VolumeSearchCacheJpaRepository jpaRepository;

    public JpaVolumeSearchCacheRepositoryAdapter(VolumeSearchCacheJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Optional<List<VolumeCandidate>> find(UUID entityTypeId, String seriesTitle, String author) {
        return jpaRepository.findByEntityTypeIdAndSeriesTitleAndAuthor(entityTypeId, seriesTitle, author)
                .map(VolumeSearchCacheJpaEntity::getVolumes);
    }

    @Override
    public void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes) {
        // Upsert: reuses the existing id for this key (refresh),
        // otherwise creates a new one - never two rows for the same key
        // (UNIQUE constraint on the database side, see V3__volume_search_cache.sql).
        UUID id = jpaRepository.findByEntityTypeIdAndSeriesTitleAndAuthor(entityTypeId, seriesTitle, author)
                .map(VolumeSearchCacheJpaEntity::getId)
                .orElseGet(UUID::randomUUID);
        jpaRepository.save(new VolumeSearchCacheJpaEntity(id, entityTypeId, seriesTitle, author, volumes, Instant.now()));
    }

    @Override
    public void delete(UUID entityTypeId, String seriesTitle, String author) {
        jpaRepository.findByEntityTypeIdAndSeriesTitleAndAuthor(entityTypeId, seriesTitle, author)
                .ifPresent(jpaRepository::delete);
    }

    @Override
    public List<StoredVolumeSearch> findAllByEntityTypeIdAndSeriesTitleIn(UUID entityTypeId, Collection<String> seriesTitles) {
        if (seriesTitles.isEmpty()) {
            return List.of();
        }
        return jpaRepository.findAllByEntityTypeIdAndSeriesTitleIn(entityTypeId, seriesTitles).stream()
                .map(row -> new StoredVolumeSearch(row.getSeriesTitle(), row.getAuthor(), row.getVolumes(), row.getFetchedAt()))
                .toList();
    }

    @Override
    public List<StoredVolumeSearchKey> findKeysByEntityTypeId(UUID entityTypeId) {
        return jpaRepository.findAllByEntityTypeId(entityTypeId).stream()
                .map(row -> new StoredVolumeSearchKey(row.getSeriesTitle(), row.getAuthor(), row.getFetchedAt()))
                .toList();
    }
}
