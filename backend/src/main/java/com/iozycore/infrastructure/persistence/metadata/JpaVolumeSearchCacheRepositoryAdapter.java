package com.iozycore.infrastructure.persistence.metadata;

import com.iozycore.metadata.VolumeCandidate;
import com.iozycore.metadata.VolumeSearchCacheRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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
        // Upsert : réutilise l'id existant pour cette clé (rafraîchissement),
        // sinon en crée une nouvelle - jamais deux lignes pour la même clé
        // (contrainte UNIQUE côté base, voir V3__volume_search_cache.sql).
        UUID id = jpaRepository.findByEntityTypeIdAndSeriesTitleAndAuthor(entityTypeId, seriesTitle, author)
                .map(VolumeSearchCacheJpaEntity::getId)
                .orElseGet(UUID::randomUUID);
        jpaRepository.save(new VolumeSearchCacheJpaEntity(id, entityTypeId, seriesTitle, author, volumes, Instant.now()));
    }
}
