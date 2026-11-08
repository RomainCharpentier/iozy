package com.iozycore.core.infrastructure.persistence.releaserefresh;

import com.iozycore.core.domain.insights.ReleaseRefreshRun;
import com.iozycore.core.domain.insights.ReleaseRefreshRunRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface ReleaseRefreshRunJpaRepository extends JpaRepository<ReleaseRefreshRunJpaEntity, UUID> {
    // By end, not by start: a night slot skipped while a long pass runs starts after it
    // but ends before it, and must not hide it (lot 208).
    Optional<ReleaseRefreshRunJpaEntity> findFirstByOrderByFinishedAtDesc();

    Optional<ReleaseRefreshRunJpaEntity> findFirstByOutcomeInOrderByFinishedAtDesc(Collection<String> outcomes);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaReleaseRefreshRunRepositoryAdapter implements ReleaseRefreshRunRepository {

    private final ReleaseRefreshRunJpaRepository jpaRepository;

    @Override
    public ReleaseRefreshRun save(ReleaseRefreshRun run) {
        return toDomain(jpaRepository.save(new ReleaseRefreshRunJpaEntity(run.id(), run.startedAt(), run.finishedAt(),
                run.origin().name(), run.stale(), run.refreshed(), run.stoppedOnUnavailableProvider(), run.error(), run.outcome().name())));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ReleaseRefreshRun> findLatest() {
        return jpaRepository.findFirstByOrderByFinishedAtDesc().map(JpaReleaseRefreshRunRepositoryAdapter::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ReleaseRefreshRun> findLatestSuccessful() {
        List<String> successful = Arrays.stream(ReleaseRefreshRun.Outcome.values())
                .filter(ReleaseRefreshRun.Outcome::isSuccess).map(Enum::name).toList();
        return jpaRepository.findFirstByOutcomeInOrderByFinishedAtDesc(successful)
                .map(JpaReleaseRefreshRunRepositoryAdapter::toDomain);
    }

    private static ReleaseRefreshRun toDomain(ReleaseRefreshRunJpaEntity jpa) {
        return new ReleaseRefreshRun(jpa.getId(), jpa.getStartedAt(), jpa.getFinishedAt(),
                ReleaseRefreshRun.Origin.valueOf(jpa.getOrigin()), jpa.getStaleCount(), jpa.getRefreshedCount(),
                jpa.isStoppedOnProvider(), jpa.getError(),
                ReleaseRefreshRun.Outcome.valueOf(jpa.getOutcome()));
    }
}
