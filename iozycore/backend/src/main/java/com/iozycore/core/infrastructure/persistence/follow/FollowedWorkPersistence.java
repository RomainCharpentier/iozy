package com.iozycore.core.infrastructure.persistence.follow;

import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface FollowedWorkJpaRepository extends JpaRepository<FollowedWorkJpaEntity, UUID> {
    Optional<FollowedWorkJpaEntity> findByEntityId(UUID entityId);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaFollowedWorkRepositoryAdapter implements FollowedWorkRepository {

    private final FollowedWorkJpaRepository jpaRepository;

    @Override
    public FollowedWork save(FollowedWork work) {
        FollowedWorkJpaEntity saved = jpaRepository.save(new FollowedWorkJpaEntity(
                work.id(), work.entityId(), work.ownerId(), work.followedAt()));
        return versDomaine(saved);
    }

    @Override
    public Optional<FollowedWork> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).map(JpaFollowedWorkRepositoryAdapter::versDomaine);
    }

    @Override
    public List<FollowedWork> findAll() {
        return jpaRepository.findAll().stream().map(JpaFollowedWorkRepositoryAdapter::versDomaine).toList();
    }

    @Override
    public void deleteByEntityId(UUID entityId) {
        // Through a filtered READ, never a delete by key: it
        // would bypass the owner isolation (same rule as the
        // wishes). Nothing to delete is the normal case.
        jpaRepository.findByEntityId(entityId).ifPresent(jpaRepository::delete);
    }

    private static FollowedWork versDomaine(FollowedWorkJpaEntity jpa) {
        return FollowedWork.reconstitute(jpa.getId(), jpa.getEntityId(), jpa.getOwnerId(), jpa.getFollowedAt());
    }
}
