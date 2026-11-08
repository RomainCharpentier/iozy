package com.iozycore.integration;

import com.iozycore.core.domain.insights.ReleaseRefreshRun;
import com.iozycore.core.domain.insights.ReleaseRefreshRunRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The passes of the release refresh survive in the real schema (V36), and the
 * latest one is the one that started last - not the last one written.
 */
class ReleaseRefreshRunPersistenceIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private ReleaseRefreshRunRepository runs;

    @Test
    void keeps_a_pass_with_everything_it_said_and_finds_the_one_that_started_last() {
        // Far in the future: no pass of another test can start after these.
        Instant later = Instant.parse("2999-01-02T04:30:00Z");
        Instant earlier = Instant.parse("2999-01-01T04:30:00Z");
        runs.save(new ReleaseRefreshRun(UUID.randomUUID(), later, later.plusSeconds(40), ReleaseRefreshRun.Origin.MANUAL,
                12, 10, true, "quota"));
        // Written after, but started before: it must not be "the latest".
        runs.save(new ReleaseRefreshRun(UUID.randomUUID(), earlier, earlier.plusSeconds(5), ReleaseRefreshRun.Origin.SCHEDULED,
                0, 0, false, null));

        ReleaseRefreshRun latest = runs.findLatest().orElseThrow();

        assertThat(latest.startedAt()).isEqualTo(later);
        assertThat(latest.finishedAt()).isEqualTo(later.plusSeconds(40));
        assertThat(latest.origin()).isEqualTo(ReleaseRefreshRun.Origin.MANUAL);
        assertThat(latest.stale()).isEqualTo(12);
        assertThat(latest.refreshed()).isEqualTo(10);
        assertThat(latest.remaining()).isEqualTo(2);
        assertThat(latest.stoppedOnUnavailableProvider()).isTrue();
        assertThat(latest.error()).isEqualTo("quota");
        assertThat(latest.outcome()).isEqualTo(ReleaseRefreshRun.Outcome.FAILED);
    }

    @Test
    void finds_the_last_pass_that_moved_the_calendar_forward_and_keeps_skipped_and_timed_out_passes() {
        // Further in the future than the other test: these are the latest rows.
        Instant base = Instant.parse("3999-01-01T04:30:00Z");
        runs.save(new ReleaseRefreshRun(UUID.randomUUID(), base, base.plusSeconds(30), ReleaseRefreshRun.Origin.CATCH_UP,
                3, 1, true, null));
        runs.save(new ReleaseRefreshRun(UUID.randomUUID(), base.plusSeconds(60), base.plusSeconds(60),
                ReleaseRefreshRun.Origin.SCHEDULED, 0, 0, false, null, ReleaseRefreshRun.Outcome.SKIPPED));
        runs.save(new ReleaseRefreshRun(UUID.randomUUID(), base.plusSeconds(120), base.plusSeconds(1920),
                ReleaseRefreshRun.Origin.MANUAL, 0, 0, false, "Passe abandonnée", ReleaseRefreshRun.Outcome.TIMED_OUT));

        assertThat(runs.findLatest().orElseThrow().outcome()).isEqualTo(ReleaseRefreshRun.Outcome.TIMED_OUT);
        ReleaseRefreshRun success = runs.findLatestSuccessful().orElseThrow();
        assertThat(success.startedAt()).isEqualTo(base);
        assertThat(success.origin()).isEqualTo(ReleaseRefreshRun.Origin.CATCH_UP);
        assertThat(success.outcome()).isEqualTo(ReleaseRefreshRun.Outcome.PARTIAL);
    }
}
