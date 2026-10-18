package com.iozycore.manga.infrastructure.followededition;

import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
class JpaFollowedEditionRepositoryAdapter implements FollowedEditionRepository {

    private final FollowedEditionJpaRepository jpaRepository;

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
        // An empty list would produce an `IN ()` that Postgres refuses - we short-circuit
        // rather than let the caller remember it.
        if (entityIds.isEmpty()) {
            return List.of();
        }
        return jpaRepository.findByEntityIdIn(entityIds).stream()
                .map(JpaFollowedEditionRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteByEntityId(UUID entityId) {
        // A BULK delete (deleteBy…) does not go through the
        // separation either: it deletes everyone's rows. We read
        // first - the read, for its part, is filtered - then we delete.
        jpaRepository.findByEntityId(entityId).ifPresent(jpaRepository::delete);
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
