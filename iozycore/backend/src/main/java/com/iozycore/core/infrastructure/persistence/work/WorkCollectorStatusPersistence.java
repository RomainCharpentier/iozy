package com.iozycore.core.infrastructure.persistence.work;

import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkCollectorStatus;
import com.iozycore.core.domain.work.WorkCollectorStatusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface WorkCollectorStatusJpaRepository extends JpaRepository<WorkCollectorStatusJpaEntity, UUID> {
    // A derived query, so filtered by owner - never findById (loads by key, unfiltered).
    Optional<WorkCollectorStatusJpaEntity> findByEntityId(UUID entityId);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaWorkCollectorStatusRepositoryAdapter implements WorkCollectorStatusRepository {

    private final WorkCollectorStatusJpaRepository jpaRepository;

    @Override
    public WorkCollectorStatus save(WorkCollectorStatus status) {
        return toDomain(jpaRepository.save(new WorkCollectorStatusJpaEntity(status.id(), status.entityId(),
                status.ownerId(), status.status().name(), status.updatedAt())));
    }

    @Override
    public Optional<WorkCollectorStatus> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).map(JpaWorkCollectorStatusRepositoryAdapter::toDomain);
    }

    @Override
    public List<WorkCollectorStatus> findAll() {
        return jpaRepository.findAll().stream().map(JpaWorkCollectorStatusRepositoryAdapter::toDomain).toList();
    }

    private static WorkCollectorStatus toDomain(WorkCollectorStatusJpaEntity jpa) {
        return WorkCollectorStatus.reconstitute(jpa.getId(), jpa.getEntityId(), jpa.getOwnerId(),
                CollectorStatus.valueOf(jpa.getStatus()), jpa.getUpdatedAt());
    }
}
