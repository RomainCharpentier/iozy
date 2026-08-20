package com.iozycore.infrastructure.persistence.tierlist;

import com.iozycore.domain.tierlist.Rank;
import com.iozycore.domain.tierlist.TierList;
import com.iozycore.domain.tierlist.TierListRepository;
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
    List<TierListJpaEntity> findByEntityTypeId(UUID entityTypeId);

    List<TierListJpaEntity> findByEntityTypeIdIsNull();
}

@Repository
@Transactional
class JpaTierListRepositoryAdapter implements TierListRepository {

    private final TierListJpaRepository jpaRepository;

    JpaTierListRepositoryAdapter(TierListJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public TierList save(TierList tierList) {
        return toDomain(jpaRepository.save(toJpa(tierList)));
    }

    @Override
    public Optional<TierList> findById(UUID id) {
        return jpaRepository.findById(id).map(JpaTierListRepositoryAdapter::toDomain);
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
        jpaRepository.deleteById(id);
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
