package com.iozycore.videogame.infrastructure;

import com.iozycore.videogame.franchise.Franchise;
import com.iozycore.videogame.franchise.FranchiseCache;
import com.iozycore.videogame.franchise.StoredFranchise;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
@Transactional
@RequiredArgsConstructor
public class JpaFranchiseCache implements FranchiseCache {

    private final VideoGameFranchiseCacheJpaRepository jpaRepository;

    @Override
    @Transactional(readOnly = true)
    public Map<String, StoredFranchise> findAll(Collection<String> igdbIds) {
        if (igdbIds.isEmpty()) {
            return Map.of();
        }
        return jpaRepository.findAllById(igdbIds).stream()
                .collect(Collectors.toMap(VideoGameFranchiseCacheJpaEntity::getIgdbId,
                        row -> new StoredFranchise(row.getIgdbId(),
                                new Franchise(row.getFranchiseName(), row.getGames()), row.getFetchedAt())));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Instant> fetchedAtById() {
        return jpaRepository.findAllKeys().stream()
                .collect(Collectors.toMap(VideoGameFranchiseCacheJpaRepository.KeyView::getIgdbId,
                        VideoGameFranchiseCacheJpaRepository.KeyView::getFetchedAt));
    }

    @Override
    public void save(String igdbId, Franchise franchise, Instant fetchedAt) {
        jpaRepository.save(new VideoGameFranchiseCacheJpaEntity(igdbId, franchise.name(),
                List.copyOf(franchise.games()), fetchedAt));
    }
}
