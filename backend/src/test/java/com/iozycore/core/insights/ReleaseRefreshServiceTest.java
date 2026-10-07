package com.iozycore.core.insights;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The refresh of the release dates, seen from the core: what a pass records,
 * who started it, and the rule of one pass at a time. A universe's own re-read
 * has its tests in its own package.
 */
class ReleaseRefreshServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-07T10:00:00Z");

    private final InMemoryRuns runs = new InMemoryRuns();

    private ReleaseRefreshService service(boolean scheduledEnabled, ReleaseRefreshSource... sources) {
        // The "background" executor runs the task in place: the test reads the result right after.
        return new ReleaseRefreshService(List.of(sources), runs, scheduledEnabled, Clock.fixed(NOW, ZoneOffset.UTC), Runnable::run);
    }

    @Test
    void a_manual_pass_records_what_the_sources_did_and_says_a_person_started_it() {
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(25, 10, false),
                () -> new ReleaseRefreshSource.Result(3, 3, true));

        assertThat(service.startManual()).isTrue();

        ReleaseRefreshRun run = service.lastRun().orElseThrow();
        assertThat(run.origin()).isEqualTo(ReleaseRefreshRun.Origin.MANUAL);
        assertThat(run.startedAt()).isEqualTo(NOW);
        assertThat(run.stale()).isEqualTo(28);
        assertThat(run.refreshed()).isEqualTo(13);
        assertThat(run.remaining()).isEqualTo(15);
        assertThat(run.stoppedOnUnavailableProvider()).isTrue();
        assertThat(run.error()).isNull();
        assertThat(service.isRunning()).isFalse();
    }

    @Test
    void the_night_pass_is_recorded_as_scheduled_and_skipped_when_turned_off() {
        service(true, () -> new ReleaseRefreshSource.Result(1, 1, false)).nightly();
        assertThat(runs.saved).singleElement().satisfies(run -> assertThat(run.origin()).isEqualTo(ReleaseRefreshRun.Origin.SCHEDULED));

        runs.saved.clear();
        service(false, () -> new ReleaseRefreshSource.Result(1, 1, false)).nightly();
        assertThat(runs.saved).isEmpty();
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
    void a_failing_source_leaves_its_error_and_does_not_hide_the_others() {
        ReleaseRefreshService service = service(true,
                () -> {
                    throw new IllegalStateException("la base ne répond pas");
                },
                () -> new ReleaseRefreshSource.Result(4, 4, false));

        service.startManual();

        ReleaseRefreshRun run = service.lastRun().orElseThrow();
        assertThat(run.error()).isEqualTo("la base ne répond pas");
        assertThat(run.refreshed()).isEqualTo(4);
        assertThat(service.isRunning()).isFalse();
    }

    @Test
    void without_any_source_there_is_nothing_to_launch_and_nothing_is_recorded() {
        ReleaseRefreshService service = service(true);

        assertThat(service.isAvailable()).isFalse();
        assertThat(service.startManual()).isFalse();
        service.nightly();
        assertThat(runs.saved).isEmpty();
        assertThat(service.lastRun()).isEmpty();
    }

    @Test
    void says_the_last_pass_whoever_started_it() {
        ReleaseRefreshService service = service(true, () -> new ReleaseRefreshSource.Result(0, 0, false));
        service.nightly();
        service.startManual();

        assertThat(runs.saved).hasSize(2);
        assertThat(service.lastRun().orElseThrow().origin()).isEqualTo(ReleaseRefreshRun.Origin.MANUAL);
    }

    private static class InMemoryRuns implements ReleaseRefreshRunRepository {
        final List<ReleaseRefreshRun> saved = new ArrayList<>();

        @Override
        public ReleaseRefreshRun save(ReleaseRefreshRun run) {
            saved.add(run);
            return run;
        }

        @Override
        public Optional<ReleaseRefreshRun> findLatest() {
            return saved.isEmpty() ? Optional.empty() : Optional.of(saved.get(saved.size() - 1));
        }
    }
}
