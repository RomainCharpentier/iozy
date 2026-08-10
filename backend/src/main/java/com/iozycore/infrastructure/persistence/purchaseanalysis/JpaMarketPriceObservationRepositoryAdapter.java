package com.iozycore.infrastructure.persistence.purchaseanalysis;

import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.MarketPriceObservationRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Repository
@Transactional
public class JpaMarketPriceObservationRepositoryAdapter implements MarketPriceObservationRepository {

    private final MarketPriceObservationJpaRepository jpaRepository;

    public JpaMarketPriceObservationRepositoryAdapter(MarketPriceObservationJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public MarketPriceObservation save(MarketPriceObservation observation) {
        return MarketPriceObservationMapper.toDomain(jpaRepository.save(MarketPriceObservationMapper.toJpa(observation)));
    }

    @Override
    public List<MarketPriceObservation> findByEditionId(UUID mangaEditionId) {
        return jpaRepository.findByMangaEditionId(mangaEditionId).stream()
                .map(MarketPriceObservationMapper::toDomain)
                .toList();
    }
}
