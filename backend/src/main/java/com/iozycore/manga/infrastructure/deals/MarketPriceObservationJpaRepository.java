package com.iozycore.manga.infrastructure.deals;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MarketPriceObservationJpaRepository extends JpaRepository<MarketPriceObservationJpaEntity, UUID> {

    /**
     * In native SQL <b>on purpose</b>: the separation by owner
     * (@TenantId) applies to ORM queries, not to native SQL. This is
     * precisely what is needed here - the question is about the integrity of a
     * shared piece of data, not about what the current account owns.
     */
    @Query(value = "SELECT count(*) FROM market_price_observation WHERE manga_edition_id = ?1", nativeQuery = true)
    int countByEditionIdAllOwners(UUID mangaEditionId);
    List<MarketPriceObservationJpaEntity> findByMangaEditionId(UUID mangaEditionId);
}
