package com.iozycore.videogame.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;

public interface VideoGameFranchiseCacheJpaRepository extends JpaRepository<VideoGameFranchiseCacheJpaEntity, String> {

    /** The key and the freshness only: the JSON of the games is not loaded. */
    @Query("select c.igdbId as igdbId, c.fetchedAt as fetchedAt from VideoGameFranchiseCacheJpaEntity c")
    List<KeyView> findAllKeys();

    interface KeyView {
        String getIgdbId();

        Instant getFetchedAt();
    }
}
