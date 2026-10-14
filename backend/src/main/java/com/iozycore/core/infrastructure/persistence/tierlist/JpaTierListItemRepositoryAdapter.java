package com.iozycore.core.infrastructure.persistence.tierlist;

import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierListItem;
import com.iozycore.core.domain.tierlist.TierListItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

interface TierListItemJpaRepository extends JpaRepository<TierListItemJpaEntity, UUID> {
    Optional<TierListItemJpaEntity> findByTierListIdAndEntityId(UUID tierListId, UUID entityId);
    List<TierListItemJpaEntity> findByTierListId(UUID tierListId);
    List<TierListItemJpaEntity> findByEntityId(UUID entityId);
    void deleteByTierListIdAndEntityId(UUID tierListId, UUID entityId);
    void deleteByTierListId(UUID tierListId);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaTierListItemRepositoryAdapter implements TierListItemRepository {

    private final TierListItemJpaRepository jpaRepository;

    @Override
    public TierListItem save(TierListItem item) {
        return toDomain(jpaRepository.save(toJpa(item)));
    }

    @Override
    public Optional<TierListItem> findByTierListIdAndEntityId(UUID tierListId, UUID entityId) {
        return jpaRepository.findByTierListIdAndEntityId(tierListId, entityId).map(JpaTierListItemRepositoryAdapter::toDomain);
    }

    @Override
    public List<TierListItem> findByTierListId(UUID tierListId) {
        return jpaRepository.findByTierListId(tierListId).stream()
                .map(JpaTierListItemRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<TierListItem> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).stream()
                .map(JpaTierListItemRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteByTierListIdAndEntityId(UUID tierListId, UUID entityId) {
        // Filtered read then delete: a bulk delete
        // (deleteBy...) does not go through the owner isolation.
        jpaRepository.findByTierListIdAndEntityId(tierListId, entityId).ifPresent(jpaRepository::delete);
    }

    @Override
    public void deleteByTierListId(UUID tierListId) {
        // Same: we delete what THIS account sees in this list.
        jpaRepository.deleteAll(jpaRepository.findByTierListId(tierListId));
    }

    private static TierListItemJpaEntity toJpa(TierListItem item) {
        return new TierListItemJpaEntity(item.id(), item.tierListId(), item.entityId(),
                item.rank().map(Enum::name).orElse(null), item.addedAt());
    }

    private static TierListItem toDomain(TierListItemJpaEntity jpa) {
        Rank rank = jpa.getRank() == null ? null : Rank.valueOf(jpa.getRank());
        return TierListItem.reconstitute(jpa.getId(), jpa.getTierListId(), jpa.getEntityId(), rank, jpa.getAddedAt());
    }
}
