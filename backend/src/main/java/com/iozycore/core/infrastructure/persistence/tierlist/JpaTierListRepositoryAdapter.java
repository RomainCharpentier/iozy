package com.iozycore.core.infrastructure.persistence.tierlist;

import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

interface TierListJpaRepository extends JpaRepository<TierListJpaEntity, UUID> {

    /**
     * Load by id, but THROUGH A QUERY.
     *
     * <p>JPA {@code findById} loads by primary key without a query:
     * Hibernate does not apply the owner isolation there
     * (see ProprietaireCourant), and the row of ANOTHER account comes back -
     * found while writing the isolation test, which passed on the lists and
     * failed on loads by id. This variant is a derived
     * query, so it is filtered like the others.
     */
    Optional<TierListJpaEntity> findOneById(UUID id);
    List<TierListJpaEntity> findByEntityTypeId(UUID entityTypeId);

    List<TierListJpaEntity> findByEntityTypeIdIsNull();
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaTierListRepositoryAdapter implements TierListRepository {

    private final TierListJpaRepository jpaRepository;

    @Override
    public TierList save(TierList tierList) {
        return toDomain(jpaRepository.save(toJpa(tierList)));
    }

    @Override
    public Optional<TierList> findById(UUID id) {
        return jpaRepository.findOneById(id).map(JpaTierListRepositoryAdapter::toDomain);
    }

    @Override
    public List<TierList> findByEntityTypeId(UUID entityTypeId) {
        return jpaRepository.findByEntityTypeId(entityTypeId).stream()
                .map(JpaTierListRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<TierList> findAllUniversesLists() {
        return jpaRepository.findByEntityTypeIdIsNull().stream()
                .map(JpaTierListRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteById(UUID id) {
        // Go through a filtered READ, never through deleteById: it
        // loads by primary key without a query, so without the owner
        // isolation - it deleted the row of another account, with no error and
        // no trace (found by the isolation test). Nothing to delete is
        // also the normal case: the port contract is idempotent.
        jpaRepository.findOneById(id).ifPresent(jpaRepository::delete);
    }

    static String serializeRanks(Set<Rank> ranks) {
        return ranks.stream().map(Enum::name).collect(Collectors.joining(","));
    }

    static Set<Rank> deserializeRanks(String value) {
        return Arrays.stream(value.split(","))
                .map(Rank::valueOf)
                .collect(Collectors.toCollection(() -> EnumSet.noneOf(Rank.class)));
    }

    private static TierListJpaEntity toJpa(TierList tierList) {
        return new TierListJpaEntity(tierList.id(), tierList.ownerId(), tierList.name(),
                tierList.entityTypeId().orElse(null), serializeRanks(tierList.activeRanks()),
                tierList.description().orElse(null), tierList.createdAt());
    }

    private static TierList toDomain(TierListJpaEntity jpa) {
        return TierList.reconstitute(jpa.getId(), jpa.getOwnerId(), jpa.getName(), jpa.getEntityTypeId(),
                deserializeRanks(jpa.getActiveRanks()), jpa.getDescription(), jpa.getCreatedAt());
    }
}
