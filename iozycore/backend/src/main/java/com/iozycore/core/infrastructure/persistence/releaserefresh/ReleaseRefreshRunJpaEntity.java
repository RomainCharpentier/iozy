package com.iozycore.core.infrastructure.persistence.releaserefresh;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import java.time.Instant;
import java.util.UUID;

/** See V36__release_refresh_run.sql - no owner column: the refresh works on the shared catalog. */
@Entity
@Table(name = "release_refresh_run")
@Getter
public class ReleaseRefreshRunJpaEntity {

    @Id
    private UUID id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at", nullable = false)
    private Instant finishedAt;

    @Column(nullable = false)
    private String origin;

    @Column(name = "stale_count", nullable = false)
    private int staleCount;

    @Column(name = "refreshed_count", nullable = false)
    private int refreshedCount;

    @Column(name = "stopped_on_provider", nullable = false)
    private boolean stoppedOnProvider;

    private String error;

    /** See V41__release_refresh_run_outcome.sql. */
    @Column(nullable = false)
    private String outcome;

    protected ReleaseRefreshRunJpaEntity() {
        // required by JPA
    }

    public ReleaseRefreshRunJpaEntity(UUID id, Instant startedAt, Instant finishedAt, String origin, int staleCount,
                                      int refreshedCount, boolean stoppedOnProvider, String error,
                                      String outcome) {
        this.id = id;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
        this.origin = origin;
        this.staleCount = staleCount;
        this.refreshedCount = refreshedCount;
        this.stoppedOnProvider = stoppedOnProvider;
        this.error = error;
        this.outcome = outcome;
    }

    public boolean isStoppedOnProvider() { return stoppedOnProvider; }
}
