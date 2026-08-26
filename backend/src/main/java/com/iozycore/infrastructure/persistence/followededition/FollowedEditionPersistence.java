package com.iozycore.infrastructure.persistence.followededition;

import com.iozycore.domain.followededition.FollowedEdition;
import com.iozycore.domain.followededition.FollowedEditionRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

interface FollowedEditionJpaRepository extends JpaRepository<FollowedEditionJpaEntity, UUID> {
    Optional<FollowedEditionJpaEntity> findByEntityId(UUID entityId);

    List<FollowedEditionJpaEntity> findByEntityIdIn(List<UUID> entityIds);

    void deleteByEntityId(UUID entityId);
}

@Repository
@Transactional
class JpaFollowedEditionRepositoryAdapter implements FollowedEditionRepository {

    private final FollowedEditionJpaRepository jpaRepository;

    JpaFollowedEditionRepositoryAdapter(FollowedEditionJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public FollowedEdition save(FollowedEdition followedEdition) {
        return toDomain(jpaRepository.save(toJpa(followedEdition)));
    }

    @Override
    public Optional<FollowedEdition> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).map(JpaFollowedEditionRepositoryAdapter::toDomain);
    }

    @Override
    public List<FollowedEdition> findByEntityIdIn(List<UUID> entityIds) {
        // Une liste vide produirait un `IN ()` que Postgres refuse - on court-circuite
        // plutôt que de laisser l'appelant s'en souvenir.
        if (entityIds.isEmpty()) {
            return List.of();
        }
        return jpaRepository.findByEntityIdIn(entityIds).stream()
                .map(JpaFollowedEditionRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteByEntityId(UUID entityId) {
        jpaRepository.deleteByEntityId(entityId);
    }

    private static FollowedEditionJpaEntity toJpa(FollowedEdition followedEdition) {
        return new FollowedEditionJpaEntity(followedEdition.id(), followedEdition.entityId(),
                followedEdition.ownerId(), followedEdition.editionName(), followedEdition.followedAt());
    }

    private static FollowedEdition toDomain(FollowedEditionJpaEntity jpa) {
        return FollowedEdition.reconstitute(jpa.getId(), jpa.getEntityId(), jpa.getOwnerId(),
                jpa.getEditionName(), jpa.getFollowedAt());
    }
}
