package com.iozycore.manga.infrastructure.deals;

import com.iozycore.manga.domain.deals.MarketPriceObservation;
import com.iozycore.manga.domain.deals.MarketPriceObservationRepository;
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
        // Go through a filtered READ, never through JPA deleteById: it loads
        // by primary key without a query, so without the owner isolation,
        // and it deleted the row of another account. Nothing to delete is
        // the normal case too: the port contract is idempotent.
        jpaRepository.findOneById(id).ifPresent(jpaRepository::delete);
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
