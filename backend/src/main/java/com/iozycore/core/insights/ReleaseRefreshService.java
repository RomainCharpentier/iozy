package com.iozycore.core.insights;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Keeps the release dates fresh and remembers when it last did.
 *
 * <p>The universes that can re-read their providers are {@link ReleaseRefreshSource}s;
 * this service runs them all, at night or when a person asks, and records each
 * pass in {@link ReleaseRefreshRunRepository}. In local mode the machine may be
 * off at 04:30: the recorded date tells the person that the calendar is stale,
 * and the manual launch lets them refresh it when they choose.
 *
 * <p>One pass at a time: a launch while another pass runs is refused, so that a
 * double click never doubles the calls to a provider with a daily quota.
 */
@Service
@Slf4j
public class ReleaseRefreshService {

    private static final int MAX_ERROR_LENGTH = 500;

    private final List<ReleaseRefreshSource> sources;
    private final ReleaseRefreshRunRepository runs;
    private final boolean scheduledEnabled;
    private final Clock clock;
    private final Executor manualExecutor;
    private final AtomicBoolean running = new AtomicBoolean(false);

    @Autowired
    public ReleaseRefreshService(List<ReleaseRefreshSource> sources, ReleaseRefreshRunRepository runs,
                                 @Value("${iozycore.releases.refresh.enabled:true}") boolean scheduledEnabled) {
        this(sources, runs, scheduledEnabled, Clock.systemUTC(), Executors.newSingleThreadExecutor(task -> {
            Thread thread = new Thread(task, "release-refresh");
            thread.setDaemon(true);
            return thread;
        }));
    }

    ReleaseRefreshService(List<ReleaseRefreshSource> sources, ReleaseRefreshRunRepository runs, boolean scheduledEnabled,
                          Clock clock, Executor manualExecutor) {
        this.sources = List.copyOf(sources);
        this.runs = runs;
        this.scheduledEnabled = scheduledEnabled;
        this.clock = clock;
        this.manualExecutor = manualExecutor;
    }

    /** True when at least one universe can refresh its dates; without one there is nothing to launch. */
    public boolean isAvailable() {
        return !sources.isEmpty();
    }

    public boolean isRunning() {
        return running.get();
    }

    public Optional<ReleaseRefreshRun> lastRun() {
        return runs.findLatest();
    }

    /**
     * Starts a pass in the background and returns at once.
     *
     * @return false when nothing can be refreshed or a pass is already running
     */
    public boolean startManual() {
        if (!isAvailable() || !running.compareAndSet(false, true)) {
            return false;
        }
        try {
            manualExecutor.execute(() -> runHoldingTheLock(ReleaseRefreshRun.Origin.MANUAL));
        } catch (RuntimeException e) {
            running.set(false);
            throw e;
        }
        return true;
    }

    /** The night job. Skipped when turned off, or when a manual pass is still running. */
    @Scheduled(cron = "${iozycore.releases.refresh.cron:0 30 4 * * *}")
    public void nightly() {
        if (!scheduledEnabled || !isAvailable()) {
            return;
        }
        if (!running.compareAndSet(false, true)) {
            log.info("Release refresh: a pass is already running, the night pass is skipped");
            return;
        }
        runHoldingTheLock(ReleaseRefreshRun.Origin.SCHEDULED);
    }

    private void runHoldingTheLock(ReleaseRefreshRun.Origin origin) {
        try {
            Instant startedAt = clock.instant();
            int stale = 0;
            int refreshed = 0;
            boolean stopped = false;
            String error = null;
            for (ReleaseRefreshSource source : sources) {
                try {
                    ReleaseRefreshSource.Result result = source.refresh();
                    stale += result.stale();
                    refreshed += result.refreshed();
                    stopped |= result.stoppedOnUnavailableProvider();
                } catch (RuntimeException e) {
                    // A failing source must not hide the others, and must leave a line to read.
                    log.warn("Release refresh: a source failed: {}", e.getMessage());
                    error = truncated(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
                }
            }
            ReleaseRefreshRun run = new ReleaseRefreshRun(UUID.randomUUID(), startedAt, clock.instant(), origin, stale,
                    refreshed, stopped, error);
            runs.save(run);
            log.info("Release refresh ({}): {} to re-read, {} re-read{}", origin, stale, refreshed,
                    stopped ? ", stopped on a silent provider" : "");
        } catch (RuntimeException e) {
            log.warn("Release refresh: the pass could not be recorded: {}", e.getMessage());
        } finally {
            running.set(false);
        }
    }

    private static String truncated(String message) {
        return message.length() <= MAX_ERROR_LENGTH ? message : message.substring(0, MAX_ERROR_LENGTH);
    }
}
