package com.iozycore.core.infrastructure.persistence.wishlist;

import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

interface WishlistEntryJpaRepository extends JpaRepository<WishlistEntryJpaEntity, UUID> {

    /**
     * Load by id, but THROUGH A QUERY.
     *
     * <p>JPA {@code findById} loads by primary key without a query:
     * Hibernate does not apply the owner isolation there
     * (see ProprietaireCourant), and the row of ANOTHER account comes back.
     */
    Optional<WishlistEntryJpaEntity> findOneById(UUID id);
    Optional<WishlistEntryJpaEntity> findByEntityIdAndVariantIdIsNull(UUID entityId);

    Optional<WishlistEntryJpaEntity> findByVariantId(UUID variantId);

    List<WishlistEntryJpaEntity> findAllByEntityId(UUID entityId);
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
        WishlistEntryJpaEntity saved = jpaRepository.save(new WishlistEntryJpaEntity(
                entry.id(), entry.entityId(), entry.variantId().orElse(null), entry.ownerId(), entry.addedAt()));
        return versDomaine(saved);
    }

    /**
     * `findByEntityIdAndVariantIdIsNull` and not `findByEntityId`: since
     * a wish can be about a volume (see V21), one work has as many
     * rows as wanted volumes. This method answers "is the WHOLE
     * WORK wanted?", which only makes sense for a type with no volumes.
     */
    @Override
    public Optional<WishlistEntry> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityIdAndVariantIdIsNull(entityId).map(JpaWishlistEntryRepositoryAdapter::versDomaine);
    }

    @Override
    public Optional<WishlistEntry> findByVariantId(UUID variantId) {
        return jpaRepository.findByVariantId(variantId).map(JpaWishlistEntryRepositoryAdapter::versDomaine);
    }

    @Override
    public List<WishlistEntry> findAllByEntityId(UUID entityId) {
        return jpaRepository.findAllByEntityId(entityId).stream()
                .map(JpaWishlistEntryRepositoryAdapter::versDomaine)
                .collect(Collectors.toList());
    }

    @Override
    public List<WishlistEntry> findAll() {
        return jpaRepository.findAll().stream()
                .map(JpaWishlistEntryRepositoryAdapter::versDomaine)
                .collect(Collectors.toList());
    }

    private static WishlistEntry versDomaine(WishlistEntryJpaEntity jpa) {
        return WishlistEntry.reconstitute(jpa.getId(), jpa.getEntityId(), jpa.getVariantId(), jpa.getOwnerId(),
                jpa.getAddedAt());
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
}
