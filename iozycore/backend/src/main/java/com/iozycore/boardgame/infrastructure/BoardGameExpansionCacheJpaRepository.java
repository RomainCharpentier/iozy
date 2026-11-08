package com.iozycore.boardgame.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface BoardGameExpansionCacheJpaRepository extends JpaRepository<BoardGameExpansionCacheJpaEntity, String> {

    /** The key and the freshness only: the JSON of the expansions is not loaded. */
    @Query("select c.baseBggId as baseBggId, c.fetchedAt as fetchedAt from BoardGameExpansionCacheJpaEntity c")
    List<KeyView> findAllKeys();

    interface KeyView {
        String getBaseBggId();

        Instant getFetchedAt();
    }
}
