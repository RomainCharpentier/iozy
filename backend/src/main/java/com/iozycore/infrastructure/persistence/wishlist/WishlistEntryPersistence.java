package com.iozycore.infrastructure.persistence.wishlist;

import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

interface WishlistEntryJpaRepository extends JpaRepository<WishlistEntryJpaEntity, UUID> {
    Optional<WishlistEntryJpaEntity> findByEntityId(UUID entityId);
}

@Repository
@Transactional
class JpaWishlistEntryRepositoryAdapter implements WishlistEntryRepository {

    private final WishlistEntryJpaRepository jpaRepository;

    JpaWishlistEntryRepositoryAdapter(WishlistEntryJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public WishlistEntry save(WishlistEntry entry) {
        WishlistEntryJpaEntity saved = jpaRepository.save(
                new WishlistEntryJpaEntity(entry.id(), entry.entityId(), entry.ownerId(), entry.addedAt()));
        return WishlistEntry.reconstitute(saved.getId(), saved.getEntityId(), saved.getOwnerId(), saved.getAddedAt());
    }

    @Override
    public Optional<WishlistEntry> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId)
                .map(e -> WishlistEntry.reconstitute(e.getId(), e.getEntityId(), e.getOwnerId(), e.getAddedAt()));
    }

    @Override
    public List<WishlistEntry> findAll() {
        return jpaRepository.findAll().stream()
                .map(e -> WishlistEntry.reconstitute(e.getId(), e.getEntityId(), e.getOwnerId(), e.getAddedAt()))
                .collect(Collectors.toList());
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }
}
