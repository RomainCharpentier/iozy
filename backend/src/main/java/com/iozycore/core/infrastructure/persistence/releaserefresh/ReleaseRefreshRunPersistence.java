package com.iozycore.core.infrastructure.persistence.releaserefresh;

import com.iozycore.core.insights.ReleaseRefreshRun;
import com.iozycore.core.insights.ReleaseRefreshRunRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

interface ReleaseRefreshRunJpaRepository extends JpaRepository<ReleaseRefreshRunJpaEntity, UUID> {
    Optional<ReleaseRefreshRunJpaEntity> findFirstByOrderByStartedAtDesc();
}

@Repository
@Transactional
class JpaReleaseRefreshRunRepositoryAdapter implements ReleaseRefreshRunRepository {

    private final ReleaseRefreshRunJpaRepository jpaRepository;

    JpaReleaseRefreshRunRepositoryAdapter(ReleaseRefreshRunJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public ReleaseRefreshRun save(ReleaseRefreshRun run) {
        return toDomain(jpaRepository.save(new ReleaseRefreshRunJpaEntity(run.id(), run.startedAt(), run.finishedAt(),
                run.origin().name(), run.stale(), run.refreshed(), run.stoppedOnUnavailableProvider(), run.error())));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ReleaseRefreshRun> findLatest() {
        return jpaRepository.findFirstByOrderByStartedAtDesc().map(JpaReleaseRefreshRunRepositoryAdapter::toDomain);
    }

    private static ReleaseRefreshRun toDomain(ReleaseRefreshRunJpaEntity jpa) {
        return new ReleaseRefreshRun(jpa.getId(), jpa.getStartedAt(), jpa.getFinishedAt(),
                ReleaseRefreshRun.Origin.valueOf(jpa.getOrigin()), jpa.getStaleCount(), jpa.getRefreshedCount(),
                jpa.isStoppedOnProvider(), jpa.getError());
    }
}
