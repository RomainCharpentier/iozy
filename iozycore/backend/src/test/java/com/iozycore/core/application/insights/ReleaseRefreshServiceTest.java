package com.iozycore.core.application.insights;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.domain.insights.ReleaseRefreshRun;
import com.iozycore.core.domain.insights.ReleaseRefreshRun.Origin;
import com.iozycore.core.domain.insights.ReleaseRefreshRun.Outcome;
import com.iozycore.core.domain.insights.ReleaseRefreshRunRepository;

/**
 * The refresh of the release dates, seen from the core: what a pass records,
 * who started it, the rule of one pass at a time, the catch-up after a missed
 * night, and a stuck pass. A universe's own re-read has its tests in its own package.
 */
class ReleaseRefreshServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");

    private final InMemoryRuns runs = new InMemoryRuns();
    private final MutableClock clock = new MutableClock(NOW);

    private ReleaseRefreshService service(boolean scheduledEnabled, ReleaseRefreshSource... sources) {
        // The "background" executor runs the task in place: the test reads the result right after.
        return new ReleaseRefreshService(List.of(sources), runs, scheduledEnabled, clock, Runnable::run);
    }

    @Test
    void a_manual_pass_records_what_the_sources_did_and_says_a_person_started_it() {
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(25, 10, false),
                () -> new ReleaseRefreshSource.Result(3, 3, true));

        assertThat(service.startManual()).isTrue();

        ReleaseRefreshRun run = service.lastRun().orElseThrow();
        assertThat(run.origin()).isEqualTo(Origin.MANUAL);
        assertThat(run.startedAt()).isEqualTo(NOW);
        assertThat(run.stale()).isEqualTo(28);
        assertThat(run.refreshed()).isEqualTo(13);
        assertThat(run.remaining()).isEqualTo(15);
        assertThat(run.stoppedOnUnavailableProvider()).isTrue();
        assertThat(run.outcome()).isEqualTo(Outcome.PARTIAL);
        assertThat(run.error()).isNull();
        assertThat(service.isRunning()).isFalse();
    }

    @Test
    void the_outcome_says_whether_the_pass_moved_the_calendar_forward() {
        service(true, () -> new ReleaseRefreshSource.Result(3, 3, false)).startManual();
        service(true, () -> new ReleaseRefreshSource.Result(3, 0, true)).startManual();

        assertThat(runs.saved).extracting(ReleaseRefreshRun::outcome)
                .containsExactly(Outcome.COMPLETED, Outcome.PROVIDER_SILENT);
        assertThat(runs.findLatestSuccessful()).get().extracting(ReleaseRefreshRun::outcome).isEqualTo(Outcome.COMPLETED);
    }

    @Test
    void the_night_pass_is_recorded_as_scheduled_and_skipped_when_turned_off() {
        service(true, () -> new ReleaseRefreshSource.Result(1, 1, false)).nightly();
        assertThat(runs.saved).singleElement().satisfies(run -> assertThat(run.origin()).isEqualTo(Origin.SCHEDULED));

        runs.saved.clear();
        service(false, () -> new ReleaseRefreshSource.Result(1, 1, false)).nightly();
        assertThat(runs.saved).isEmpty();
    }

    @Test
    void the_night_pass_never_runs_on_the_scheduler_thread() {
        List<Runnable> handedOver = new ArrayList<>();
        AtomicBoolean sourceCalled = new AtomicBoolean(false);
        ReleaseRefreshService service = new ReleaseRefreshService(List.of(() -> {
            sourceCalled.set(true);
            return new ReleaseRefreshSource.Result(1, 1, false);
        }), runs, true, clock, handedOver::add);

        service.nightly();

        // The scheduler thread is free at once: a backfill behind it is not delayed.
        assertThat(sourceCalled).isFalse();
        assertThat(handedOver).hasSize(1);
        assertThat(service.isRunning()).isTrue();
        handedOver.get(0).run();
        assertThat(sourceCalled).isTrue();
        assertThat(service.isRunning()).isFalse();
    }

    @Test
    void the_scheduler_has_more_than_one_thread() throws Exception {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        Properties properties = yaml.getObject();

        assertThat(Integer.parseInt(properties.getProperty("spring.task.scheduling.pool.size"))).isGreaterThan(1);
    }

    @Test
    void a_night_slot_that_finds_a_pass_running_is_recorded_as_skipped() {
        List<Runnable> handedOver = new ArrayList<>();
        ReleaseRefreshService service = new ReleaseRefreshService(
                List.of(() -> new ReleaseRefreshSource.Result(1, 1, false)), runs, true, clock, handedOver::add);
        assertThat(service.startManual()).isTrue();

        service.nightly();

        assertThat(runs.saved).singleElement().satisfies(run -> {
            assertThat(run.origin()).isEqualTo(Origin.SCHEDULED);
            assertThat(run.outcome()).isEqualTo(Outcome.SKIPPED);
        });
    }

    @Test
    void a_skipped_night_slot_does_not_hide_the_pass_that_was_running() {
        List<Runnable> handedOver = new ArrayList<>();
        ReleaseRefreshService service = new ReleaseRefreshService(
                List.of(() -> new ReleaseRefreshSource.Result(4, 4, false)), runs, true, clock, handedOver::add);
        assertThat(service.startManual()).isTrue();
        clock.advance(Duration.ofMinutes(5));
        service.nightly();
        clock.advance(Duration.ofMinutes(5));

        handedOver.get(0).run();

        assertThat(service.lastRun()).get().satisfies(run -> {
            assertThat(run.origin()).isEqualTo(Origin.MANUAL);
            assertThat(run.outcome()).isEqualTo(Outcome.COMPLETED);
        });
    }

    @Test
    void never_runs_two_passes_at_once() {
        AtomicReference<ReleaseRefreshService> holder = new AtomicReference<>();
        AtomicBoolean secondLaunchAccepted = new AtomicBoolean(true);
        AtomicBoolean seenRunningFromInside = new AtomicBoolean(false);
        ReleaseRefreshService service = service(true, () -> {
            // A launch that arrives while this pass runs.
            seenRunningFromInside.set(holder.get().isRunning());
            secondLaunchAccepted.set(holder.get().startManual());
            return new ReleaseRefreshSource.Result(1, 1, false);
        });
        holder.set(service);

        assertThat(service.startManual()).isTrue();

        assertThat(seenRunningFromInside).isTrue();
        assertThat(secondLaunchAccepted).isFalse();
        assertThat(runs.saved).hasSize(1);
        // The lock is released at the end: the next launch goes through.
        assertThat(service.startManual()).isTrue();
    }

    @Test
    void a_stuck_pass_is_given_up_recorded_and_no_longer_blocks_the_next_one() throws Exception {
        CountDownLatch interrupted = new CountDownLatch(1);
        CountDownLatch started = new CountDownLatch(1);
        AtomicBoolean firstCall = new AtomicBoolean(true);
        ReleaseRefreshSource hangsOnce = () -> {
            if (!firstCall.getAndSet(false)) {
                return new ReleaseRefreshSource.Result(1, 1, false);
            }
            started.countDown();
            try {
                Thread.sleep(60_000);
            } catch (InterruptedException e) {
                interrupted.countDown();
            }
            return new ReleaseRefreshSource.Result(1, 1, false);
        };
        // A real thread per pass, as in production.
        ReleaseRefreshService service = new ReleaseRefreshService(List.of(hangsOnce), runs, true, clock,
                task -> new Thread(task).start());
        assertThat(service.startManual()).isTrue();
        assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(service.startManual()).isFalse();

        clock.advance(Duration.ofMinutes(31));
        assertThat(service.startManual()).isTrue();

        assertThat(interrupted.await(5, TimeUnit.SECONDS)).isTrue();
        waitUntil(() -> !service.isRunning() && runs.saved.size() == 2);
        assertThat(runs.saved).extracting(ReleaseRefreshRun::outcome).containsExactly(Outcome.TIMED_OUT, Outcome.COMPLETED);
        assertThat(runs.saved.get(0).startedAt()).isEqualTo(NOW);
        assertThat(runs.saved.get(0).error()).isNotBlank();
    }

    @Test
    void a_row_the_database_refuses_still_reaches_the_status_line() {
        runs.refuseSaves = true;
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(2, 2, false));

        service.startManual();

        assertThat(runs.saved).isEmpty();
        assertThat(service.lastRun()).get().extracting(ReleaseRefreshRun::outcome).isEqualTo(Outcome.COMPLETED);
        assertThat(service.lastSuccessfulRun()).isPresent();
        assertThat(service.isRunning()).isFalse();
    }

    @Test
    void a_failing_source_leaves_its_error_and_does_not_hide_the_others() {
        ReleaseRefreshService service = service(true,
                () -> {
                    throw new IllegalStateException("la base ne répond pas");
                },
                () -> new ReleaseRefreshSource.Result(4, 4, false));

        service.startManual();

        ReleaseRefreshRun run = service.lastRun().orElseThrow();
        assertThat(run.error()).isEqualTo("la base ne répond pas");
        assertThat(run.outcome()).isEqualTo(Outcome.FAILED);
        assertThat(run.refreshed()).isEqualTo(4);
        assertThat(service.isRunning()).isFalse();
    }

    @Test
    void after_a_missed_night_a_catch_up_pass_starts_and_then_waits_a_day() {
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(1, 1, false));
        // The machine was off at 04:30: the last success is from two days ago.
        runs.save(run(NOW.minus(Duration.ofDays(2)), Outcome.COMPLETED));

        service.catchUpIfDue();

        assertThat(runs.saved).hasSize(2);
        assertThat(service.lastRun().orElseThrow().origin()).isEqualTo(Origin.CATCH_UP);

        clock.advance(Duration.ofHours(3));
        service.catchUpIfDue();
        assertThat(runs.saved).hasSize(2);

        clock.advance(Duration.ofHours(22));
        service.catchUpIfDue();
        assertThat(runs.saved).hasSize(3);
    }

    @Test
    void with_no_pass_ever_the_catch_up_starts_one() {
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(0, 0, false));

        service.catchUpIfDue();

        assertThat(runs.saved).singleElement().extracting(ReleaseRefreshRun::origin).isEqualTo(Origin.CATCH_UP);
    }

    @Test
    void after_a_silent_pass_the_catch_up_waits_before_asking_the_provider_again() {
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(3, 0, true));
        runs.save(run(NOW.minus(Duration.ofDays(5)), Outcome.COMPLETED));
        runs.save(run(NOW.minus(Duration.ofHours(1)), Outcome.PROVIDER_SILENT));

        service.catchUpIfDue();
        assertThat(runs.saved).hasSize(2);

        clock.advance(Duration.ofHours(6));
        service.catchUpIfDue();
        assertThat(runs.saved).hasSize(3);
    }

    @Test
    void the_catch_up_is_off_when_the_night_pass_is_off() {
        ReleaseRefreshService service = service(false, () -> new ReleaseRefreshSource.Result(0, 0, false));

        service.catchUpIfDue();

        assertThat(runs.saved).isEmpty();
        assertThat(service.nextPlannedAt()).isEmpty();
    }

    @Test
    void the_next_planned_pass_is_the_night_slot_or_sooner_when_a_catch_up_is_due() {
        ReleaseRefreshService service = new ReleaseRefreshService(
                List.of(() -> new ReleaseRefreshSource.Result(0, 0, false)), runs, true, clock, Runnable::run,
                "0 30 4 * * *", ZoneId.of("Europe/Paris"), Duration.ofHours(24), Duration.ofHours(6),
                Duration.ofMinutes(30));

        // Never refreshed: a catch-up is due now.
        assertThat(service.nextPlannedAt()).contains(NOW);

        runs.save(run(NOW.minus(Duration.ofHours(1)), Outcome.COMPLETED));
        // Refreshed an hour ago: the next one is tomorrow 04:30 in Paris, 02:30 UTC.
        assertThat(service.nextPlannedAt()).contains(Instant.parse("2026-10-08T02:30:00Z"));
    }

    @Test
    void without_any_source_there_is_nothing_to_launch_and_nothing_is_recorded() {
        ReleaseRefreshService service = service(true);

        assertThat(service.isAvailable()).isFalse();
        assertThat(service.startManual()).isFalse();
        service.nightly();
        service.catchUpIfDue();
        assertThat(runs.saved).isEmpty();
        assertThat(service.lastRun()).isEmpty();
    }

    @Test
    void says_the_last_pass_whoever_started_it() {
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(0, 0, false));
        service.nightly();
        clock.advance(Duration.ofSeconds(1));
        service.startManual();

        assertThat(runs.saved).hasSize(2);
        assertThat(service.lastRun().orElseThrow().origin()).isEqualTo(Origin.MANUAL);
    }

    private static ReleaseRefreshRun run(Instant at, Outcome outcome) {
        return new ReleaseRefreshRun(UUID.randomUUID(), at, at, Origin.SCHEDULED, 1, 1, false, null, outcome);
    }

    private static void waitUntil(java.util.function.BooleanSupplier condition) throws InterruptedException {
        for (int i = 0; i < 500 && !condition.getAsBoolean(); i++) {
            Thread.sleep(10);
        }
    }

    private static class MutableClock extends Clock {
        private volatile Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private static class InMemoryRuns implements ReleaseRefreshRunRepository {
        final List<ReleaseRefreshRun> saved = java.util.Collections.synchronizedList(new ArrayList<>());
        volatile boolean refuseSaves;

        @Override
        public ReleaseRefreshRun save(ReleaseRefreshRun run) {
            if (refuseSaves) {
                throw new IllegalStateException("the database is read-only");
            }
            saved.add(run);
            return run;
        }

        @Override
        public Optional<ReleaseRefreshRun> findLatest() {
            synchronized (saved) {
                return saved.stream().max(java.util.Comparator.comparing(ReleaseRefreshRun::finishedAt));
            }
        }

        @Override
        public Optional<ReleaseRefreshRun> findLatestSuccessful() {
            synchronized (saved) {
                return saved.stream().filter(run -> run.outcome().isSuccess())
                        .max(java.util.Comparator.comparing(ReleaseRefreshRun::finishedAt));
            }
        }
    }
}
