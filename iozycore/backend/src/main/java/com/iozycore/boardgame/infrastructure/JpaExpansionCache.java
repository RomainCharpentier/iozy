package com.iozycore.boardgame.infrastructure;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionCache;
import com.iozycore.boardgame.expansion.StoredExpansions;
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
public class JpaExpansionCache implements ExpansionCache {

    private final BoardGameExpansionCacheJpaRepository jpaRepository;

    @Override
    @Transactional(readOnly = true)
    public Map<String, StoredExpansions> findAll(Collection<String> baseBggIds) {
        if (baseBggIds.isEmpty()) {
            return Map.of();
        }
        return jpaRepository.findAllById(baseBggIds).stream()
                .collect(Collectors.toMap(BoardGameExpansionCacheJpaEntity::getBaseBggId,
                        row -> new StoredExpansions(row.getBaseBggId(), row.getExpansions(), row.getFetchedAt())));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Instant> fetchedAtByBaseId() {
        return jpaRepository.findAllKeys().stream()
                .collect(Collectors.toMap(BoardGameExpansionCacheJpaRepository.KeyView::getBaseBggId,
                        BoardGameExpansionCacheJpaRepository.KeyView::getFetchedAt));
    }

    @Override
    public void save(String baseBggId, List<BoardGameExpansion> expansions, Instant fetchedAt) {
        jpaRepository.save(new BoardGameExpansionCacheJpaEntity(baseBggId, List.copyOf(expansions), fetchedAt));
    }
}
