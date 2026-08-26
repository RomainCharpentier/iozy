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
     * `findByEntityIdAndVariantIdIsNull` et non `findByEntityId` : depuis que
     * l'envie peut porter sur un tome (voir V21), une même œuvre a autant de
     * lignes que de tomes voulus. Cette méthode-ci répond à « l'ŒUVRE entière
     * est-elle voulue ? », ce qui n'a de sens que pour un type sans tome.
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
        // existsById d'abord : JpaRepository#deleteById lève EmptyResultDataAccessException si la ligne
        // n'existe déjà plus, ce qui casserait le contrat idempotent du port (voir WishlistEntryRepository).
        if (jpaRepository.existsById(id)) {
            jpaRepository.deleteById(id);
        }
    }
}
