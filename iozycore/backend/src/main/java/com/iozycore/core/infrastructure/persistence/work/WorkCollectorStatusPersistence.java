package com.iozycore.core.infrastructure.persistence.work;

import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkCollectorStatus;
import com.iozycore.core.domain.work.WorkCollectorStatusRepository;
import com.iozycore.core.infrastructure.multitenance.ProprietaireCourant;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface WorkCollectorStatusJpaRepository extends JpaRepository<WorkCollectorStatusJpaEntity, UUID> {
    // A derived query, so filtered by owner - never findById (loads by key, unfiltered).
    Optional<WorkCollectorStatusJpaEntity> findByEntityId(UUID entityId);

    /**
     * Insert or update in one statement. Two first writes for the same work at the
     * same moment (two tabs, a double click) both find no row; a plain insert would
     * make the second one fail on the unique key. Native SQL, so the owner is
     * passed by hand: {@code @TenantId} does not apply here.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO work_collector_status (id, entity_id, owner_id, status, updated_at)
            VALUES (:id, :entityId, :ownerId, :status, :updatedAt)
            ON CONFLICT (entity_id, owner_id)
            DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
            """, nativeQuery = true)
    void upsert(@Param("id") UUID id, @Param("entityId") UUID entityId, @Param("ownerId") UUID ownerId,
                @Param("status") String status, @Param("updatedAt") Instant updatedAt);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaWorkCollectorStatusRepositoryAdapter implements WorkCollectorStatusRepository {

    private final WorkCollectorStatusJpaRepository jpaRepository;
    private final ProprietaireCourant owner;

    /** One status per work and account: an existing row is updated, never duplicated. */
    @Override
    public WorkCollectorStatus save(WorkCollectorStatus status) {
        jpaRepository.upsert(status.id(), status.entityId(), owner.resolveCurrentTenantIdentifier(),
                status.status().name(), status.updatedAt() == null ? Instant.now() : status.updatedAt());
        return findByEntityId(status.entityId()).orElseThrow();
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
