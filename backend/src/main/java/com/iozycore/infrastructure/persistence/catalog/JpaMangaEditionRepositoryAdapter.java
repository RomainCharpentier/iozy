package com.iozycore.infrastructure.persistence.catalog;

import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@Transactional
public class JpaMangaEditionRepositoryAdapter implements MangaEditionRepository {

    private final MangaEditionJpaRepository jpaRepository;

    public JpaMangaEditionRepositoryAdapter(MangaEditionJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public MangaEdition save(MangaEdition edition) {
        return MangaEditionMapper.toDomain(jpaRepository.save(MangaEditionMapper.toJpa(edition)));
    }

    @Override
    public Optional<MangaEdition> findById(UUID id) {
        return jpaRepository.findById(id).map(MangaEditionMapper::toDomain);
    }

    @Override
    public Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName) {
        return jpaRepository.findBySeriesTitleIgnoreCaseAndEditionNameIgnoreCase(seriesTitle, editionName)
                .map(MangaEditionMapper::toDomain);
    }

    @Override
    public List<MangaEdition> findBySeriesTitle(String seriesTitle) {
        return jpaRepository.findBySeriesTitleIgnoreCase(seriesTitle).stream()
                .map(MangaEditionMapper::toDomain)
                .toList();
    }

    @Override
    public List<MangaEdition> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).stream()
                .map(MangaEditionMapper::toDomain)
                .toList();
    }

    @Override
    public Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName) {
        return jpaRepository.findByEntityIdAndEditionNameIgnoreCase(entityId, editionName)
                .map(MangaEditionMapper::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }
}
