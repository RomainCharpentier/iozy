package com.iozycore.core.application.insights;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.Optional;
import java.util.UUID;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;
import com.iozycore.core.domain.insights.ReleaseRefreshRun;
import com.iozycore.core.domain.insights.ReleaseRefreshRunRepository;

/**
 * Keeps the release dates fresh and remembers when it last did.
 *
 * <p>The universes that can re-read their providers are {@link ReleaseRefreshSource}s;
 * this service runs them all and records each pass in {@link ReleaseRefreshRunRepository}.
 *
 * <h2>When a pass runs</h2>
 * <ul>
 *   <li>at night ({@link #nightly()}, 04:30 by default);</li>
 *   <li>after a missed night ({@link #catchUpIfDue()}): the app is self-hosted and the
 *       machine is often off at 04:30. A few minutes after each start, then every
 *       quarter of an hour, a pass starts when the last successful one is older than
 *       {@code catch-up-after-hours}. After a pass that failed or found its provider
 *       silent, the next try waits {@code retry-after-hours}, so a quota is not hit
 *       again every quarter of an hour;</li>
 *   <li>when a person asks ({@link #startManual()}).</li>
 * </ul>
 *
 * <h2>Never stuck, never silent</h2>
 * Every pass runs on its own thread, never on the scheduler's: a long pass does not
 * delay the backfills, and a hung pass does not hold a queue. One pass at a time: a
 * launch while another pass runs is refused, so that a double click never doubles the
 * calls to a provider with a daily quota. A pass that runs longer than
 * {@code max-pass-minutes} is given up (its thread is interrupted) and recorded as
 * {@code TIMED_OUT}, so the next launch can go. A night slot that finds a pass running
 * is recorded as {@code SKIPPED}. A row that cannot be saved is logged as an error and
 * kept in memory, so the status line still tells the truth.
 */
@Service
@Slf4j
public class ReleaseRefreshService {

    private static final int MAX_ERROR_LENGTH = 500;
    static final String DEFAULT_CRON = "0 30 4 * * *";

    private final List<ReleaseRefreshSource> sources;
    private final ReleaseRefreshRunRepository runs;
    private final boolean scheduledEnabled;
    private final Clock clock;
    private final Executor passExecutor;
    private final CronExpression cron;
    private final ZoneId zone;
    private final Duration catchUpAfter;
    private final Duration retryAfter;
    private final Duration maxPassDuration;
    private final AtomicReference<Pass> current = new AtomicReference<>();
    /** The last pass whose row could not be saved: shown until a newer row exists. */
    private final AtomicReference<ReleaseRefreshRun> unrecorded = new AtomicReference<>();

    /** One running pass: its thread is known once it starts, so that a stuck pass can be interrupted. */
    private static final class Pass {
        final ReleaseRefreshRun.Origin origin;
        final Instant startedAt;
        volatile Thread thread;

        Pass(ReleaseRefreshRun.Origin origin, Instant startedAt) {
            this.origin = origin;
            this.startedAt = startedAt;
        }
    }

    @Autowired
    public ReleaseRefreshService(List<ReleaseRefreshSource> sources, ReleaseRefreshRunRepository runs,
                                 @Value("${iozycore.releases.refresh.enabled:true}") boolean scheduledEnabled,
                                 @Value("${iozycore.releases.refresh.cron:" + DEFAULT_CRON + "}") String cron,
                                 @Value("${iozycore.releases.refresh.zone:Europe/Paris}") String zone,
                                 @Value("${iozycore.releases.refresh.catch-up-after-hours:24}") long catchUpAfterHours,
                                 @Value("${iozycore.releases.refresh.retry-after-hours:6}") long retryAfterHours,
                                 @Value("${iozycore.releases.refresh.max-pass-minutes:30}") long maxPassMinutes) {
        this(sources, runs, scheduledEnabled, Clock.systemUTC(), ReleaseRefreshService::startOnOwnThread,
                cron, ZoneId.of(zone), Duration.ofHours(catchUpAfterHours), Duration.ofHours(retryAfterHours),
                Duration.ofMinutes(maxPassMinutes));
    }

    ReleaseRefreshService(List<ReleaseRefreshSource> sources, ReleaseRefreshRunRepository runs, boolean scheduledEnabled,
                          Clock clock, Executor passExecutor) {
        this(sources, runs, scheduledEnabled, clock, passExecutor, DEFAULT_CRON, clock.getZone(), Duration.ofHours(24),
                Duration.ofHours(6), Duration.ofMinutes(30));
    }

    ReleaseRefreshService(List<ReleaseRefreshSource> sources, ReleaseRefreshRunRepository runs, boolean scheduledEnabled,
                          Clock clock, Executor passExecutor, String cron, ZoneId zone, Duration catchUpAfter,
                          Duration retryAfter, Duration maxPassDuration) {
        this.sources = List.copyOf(sources);
        this.runs = runs;
        this.scheduledEnabled = scheduledEnabled;
        this.clock = clock;
        this.passExecutor = passExecutor;
        this.cron = CronExpression.parse(cron);
        this.zone = zone;
        this.catchUpAfter = catchUpAfter;
        this.retryAfter = retryAfter;
        this.maxPassDuration = maxPassDuration;
    }

    /** A new daemon thread per pass: a hung pass never blocks the next one behind it. */
    private static void startOnOwnThread(Runnable task) {
        Thread thread = new Thread(task, "release-refresh");
        thread.setDaemon(true);
        thread.start();
    }

    /** True when at least one universe can refresh its dates; without one there is nothing to launch. */
    public boolean isAvailable() {
        return !sources.isEmpty();
    }

    /** True when the night job and the catch-up are on. */
    public boolean isScheduled() {
        return scheduledEnabled && isAvailable();
    }

    public boolean isRunning() {
        return current.get() != null;
    }

    /** The pass that ended last, including one whose row could not be saved. */
    public Optional<ReleaseRefreshRun> lastRun() {
        return newest(runs.findLatest(), Optional.ofNullable(unrecorded.get()));
    }

    /** The most recent pass that moved the calendar forward. */
    public Optional<ReleaseRefreshRun> lastSuccessfulRun() {
        return newest(runs.findLatestSuccessful(),
                Optional.ofNullable(unrecorded.get()).filter(run -> run.outcome().isSuccess()));
    }

    /**
     * When the next pass should start on its own: the next night slot, or sooner when
     * a catch-up is due. Empty when nothing runs on its own.
     */
    public Optional<Instant> nextPlannedAt() {
        if (!isScheduled()) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        Instant nextNight = cron.next(now.atZone(zone)).toInstant();
        Instant catchUp = catchUpDueAt();
        Instant soonestCatchUp = catchUp.isBefore(now) ? now : catchUp;
        return Optional.of(soonestCatchUp.isBefore(nextNight) ? soonestCatchUp : nextNight);
    }

    /**
     * Starts a pass in the background and returns at once.
     *
     * @return false when nothing can be refreshed or a pass is already running
     */
    public boolean startManual() {
        expireStuckPass();
        return start(ReleaseRefreshRun.Origin.MANUAL);
    }

    /** The night job. Recorded as skipped when another pass is still running. */
    @Scheduled(cron = "${iozycore.releases.refresh.cron:" + DEFAULT_CRON + "}", zone = "${iozycore.releases.refresh.zone:Europe/Paris}")
    public void nightly() {
        if (!isScheduled()) {
            return;
        }
        expireStuckPass();
        if (!start(ReleaseRefreshRun.Origin.SCHEDULED)) {
            Instant now = clock.instant();
            log.warn("Release refresh: a pass is already running, the night pass is skipped");
            record(new ReleaseRefreshRun(UUID.randomUUID(), now, now, ReleaseRefreshRun.Origin.SCHEDULED, 0, 0, false,
                    null, ReleaseRefreshRun.Outcome.SKIPPED));
        }
    }

    /** A few minutes after each start, then regularly: makes up for a night the machine was off. */
    @Scheduled(initialDelayString = "${iozycore.releases.refresh.catch-up.initial-delay-ms:300000}",
               fixedDelayString = "${iozycore.releases.refresh.catch-up.every-ms:900000}")
    public void catchUpIfDue() {
        if (!isScheduled()) {
            return;
        }
        expireStuckPass();
        if (isRunning() || catchUpDueAt().isAfter(clock.instant())) {
            return;
        }
        log.info("Release refresh: the last successful pass is too old, a catch-up pass starts");
        start(ReleaseRefreshRun.Origin.CATCH_UP);
    }

    /** When a catch-up becomes due: a day after the last success, and not before the retry delay after a failure. */
    private Instant catchUpDueAt() {
        Instant due = lastSuccessfulRun().map(run -> run.finishedAt().plus(catchUpAfter)).orElse(Instant.EPOCH);
        Optional<ReleaseRefreshRun> last = lastRun();
        if (last.isPresent() && !last.get().outcome().isSuccess()) {
            Instant retry = last.get().finishedAt().plus(retryAfter);
            if (retry.isAfter(due)) {
                due = retry;
            }
        }
        return due;
    }

    /** Gives up a pass that ran too long: interrupts it, records it, and frees the slot. */
    void expireStuckPass() {
        Pass pass = current.get();
        Instant now = clock.instant();
        if (pass == null || !pass.startedAt.plus(maxPassDuration).isBefore(now)) {
            return;
        }
        if (!current.compareAndSet(pass, null)) {
            return;
        }
        Thread thread = pass.thread;
        if (thread != null) {
            thread.interrupt();
        }
        log.error("Release refresh: the pass started at {} ran longer than {} and was given up", pass.startedAt,
                maxPassDuration);
        record(new ReleaseRefreshRun(UUID.randomUUID(), pass.startedAt, now, pass.origin, 0, 0, false,
                "Passe abandonnée après " + maxPassDuration.toMinutes() + " min", ReleaseRefreshRun.Outcome.TIMED_OUT));
    }

    private boolean start(ReleaseRefreshRun.Origin origin) {
        if (!isAvailable()) {
            return false;
        }
        Pass pass = new Pass(origin, clock.instant());
        if (!current.compareAndSet(null, pass)) {
            return false;
        }
        try {
            passExecutor.execute(() -> run(pass));
        } catch (RuntimeException e) {
            current.compareAndSet(pass, null);
            throw e;
        }
        return true;
    }

    private void run(Pass pass) {
        pass.thread = Thread.currentThread();
        try {
            int stale = 0;
            int refreshed = 0;
            boolean silent = false;
            String error = null;
            for (ReleaseRefreshSource source : sources) {
                try {
                    ReleaseRefreshSource.Result result = source.refresh();
                    stale += result.stale();
                    refreshed += result.refreshed();
                    silent |= result.stoppedOnUnavailableProvider();
                } catch (RuntimeException e) {
                    // A failing source must not hide the others, and must leave a line to read.
                    log.warn("Release refresh: a source failed", e);
                    error = truncated(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
                }
            }
            if (current.get() != pass) {
                // Given up as stuck: its TIMED_OUT row already speaks for it.
                log.warn("Release refresh: a pass given up as stuck has ended ({} re-read)", refreshed);
                return;
            }
            record(new ReleaseRefreshRun(UUID.randomUUID(), pass.startedAt, clock.instant(), pass.origin, stale,
                    refreshed, silent, error));
            log.info("Release refresh ({}): {} to re-read, {} re-read{}", pass.origin, stale, refreshed,
                    silent ? ", a provider was silent" : "");
        } finally {
            current.compareAndSet(pass, null);
        }
    }

    /** Saves a row; when the database refuses it, says so loudly and keeps it for the status line. */
    private void record(ReleaseRefreshRun run) {
        try {
            runs.save(run);
            unrecorded.set(null);
        } catch (RuntimeException e) {
            log.error("Release refresh: the pass of {} could not be recorded ({})", run.startedAt(), run.outcome(), e);
            unrecorded.set(run);
        }
    }

    private static Optional<ReleaseRefreshRun> newest(Optional<ReleaseRefreshRun> a, Optional<ReleaseRefreshRun> b) {
        return Stream.concat(a.stream(), b.stream()).max(Comparator.comparing(ReleaseRefreshRun::finishedAt));
    }

    private static String truncated(String message) {
        return message.length() <= MAX_ERROR_LENGTH ? message : message.substring(0, MAX_ERROR_LENGTH);
    }
}
