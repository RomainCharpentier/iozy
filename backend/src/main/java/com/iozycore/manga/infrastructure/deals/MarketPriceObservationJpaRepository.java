package com.iozycore.manga.infrastructure.deals;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MarketPriceObservationJpaRepository extends JpaRepository<MarketPriceObservationJpaEntity, UUID> {

    /**
     * En SQL natif <b>à dessein</b> : le cloisonnement par propriétaire
     * (@TenantId) s'applique aux requêtes de l'ORM, pas au SQL natif. C'est
     * précisément ce qu'il faut ici - la question porte sur l'intégrité d'une
     * donnée partagée, pas sur ce que le compte courant possède.
     */
    @Query(value = "SELECT count(*) FROM market_price_observation WHERE manga_edition_id = ?1", nativeQuery = true)
    int countByEditionIdAllOwners(UUID mangaEditionId);
    List<MarketPriceObservationJpaEntity> findByMangaEditionId(UUID mangaEditionId);
}
