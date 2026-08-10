package com.iozycore.infrastructure.persistence.editionupgrade;

import com.iozycore.domain.editionupgrade.EditionUpgradeWish;
import com.iozycore.domain.editionupgrade.EditionUpgradeWishRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

interface EditionUpgradeWishJpaRepository extends JpaRepository<EditionUpgradeWishJpaEntity, UUID> {
    List<EditionUpgradeWishJpaEntity> findByEntityId(UUID entityId);
}

@Repository
@Transactional
class JpaEditionUpgradeWishRepositoryAdapter implements EditionUpgradeWishRepository {

    private final EditionUpgradeWishJpaRepository jpaRepository;

    JpaEditionUpgradeWishRepositoryAdapter(EditionUpgradeWishJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public EditionUpgradeWish save(EditionUpgradeWish wish) {
        EditionUpgradeWishJpaEntity saved = jpaRepository.save(toJpa(wish));
        return toDomain(saved);
    }

    @Override
    public Optional<EditionUpgradeWish> findById(UUID id) {
        return jpaRepository.findById(id).map(JpaEditionUpgradeWishRepositoryAdapter::toDomain);
    }

    @Override
    public List<EditionUpgradeWish> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).stream()
                .map(JpaEditionUpgradeWishRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<EditionUpgradeWish> findAll() {
        return jpaRepository.findAll().stream()
                .map(JpaEditionUpgradeWishRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    private static EditionUpgradeWishJpaEntity toJpa(EditionUpgradeWish wish) {
        return new EditionUpgradeWishJpaEntity(wish.id(), wish.entityId(), wish.ownerId(), wish.currentEditionName(),
                wish.desiredEditionName().orElse(null), wish.note().orElse(null), wish.addedAt());
    }

    private static EditionUpgradeWish toDomain(EditionUpgradeWishJpaEntity jpa) {
        return EditionUpgradeWish.reconstitute(jpa.getId(), jpa.getEntityId(), jpa.getOwnerId(),
                jpa.getCurrentEditionName(), jpa.getDesiredEditionName(), jpa.getNote(), jpa.getAddedAt());
    }
}
