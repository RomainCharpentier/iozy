package com.iozycore.manga.infrastructure.deals;

import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Repository
@Transactional
@RequiredArgsConstructor
public class JpaMarketPriceObservationRepositoryAdapter implements MarketPriceObservationRepository {

    private final MarketPriceObservationJpaRepository jpaRepository;

    @Override
    public MarketPriceObservation save(MarketPriceObservation observation) {
        return MarketPriceObservationMapper.toDomain(jpaRepository.save(MarketPriceObservationMapper.toJpa(observation)));
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public List<MarketPriceObservation> findAll() {
        return jpaRepository.findAll().stream()
                .map(MarketPriceObservationMapper::toDomain)
                .toList();
    }

    @Override
    public List<MarketPriceObservation> findByEditionId(UUID mangaEditionId) {
        return jpaRepository.findByMangaEditionId(mangaEditionId).stream()
                .map(MarketPriceObservationMapper::toDomain)
                .toList();
    }

    @Override
    public int countByEditionIdAllOwners(UUID mangaEditionId) {
        return jpaRepository.countByEditionIdAllOwners(mangaEditionId);
    }
}
