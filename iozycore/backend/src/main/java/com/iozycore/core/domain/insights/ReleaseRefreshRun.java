package com.iozycore.core.domain.insights;

import java.time.Instant;
import java.util.UUID;

/**
 * One pass of the release refresh, as it was recorded.
 *
 * @param origin  who started it: the night job, the catch-up after a missed night, or a person
 * @param stale   items that were due for a re-read at the start of the pass
 * @param refreshed items re-read; {@code stale - refreshed} is what is still waiting
 * @param stoppedOnUnavailableProvider a provider was silent during the pass (quota, outage)
 * @param error   what went wrong when the pass failed, otherwise null
 * @param outcome how the pass ended, so that the status line never has to guess
 */
public record ReleaseRefreshRun(UUID id, Instant startedAt, Instant finishedAt, Origin origin, int stale, int refreshed,
                                boolean stoppedOnUnavailableProvider, String error, Outcome outcome) {

    public enum Origin { SCHEDULED, CATCH_UP, MANUAL }

    public enum Outcome {
        /** Every provider answered. */
        COMPLETED,
        /** A provider was silent, but the pass still re-read some items. */
        PARTIAL,
        /** A provider was silent and nothing could be re-read. */
        PROVIDER_SILENT,
        /** A source threw an unexpected error. */
        FAILED,
        /** The pass did not start: another one was already running. */
        SKIPPED,
        /** The pass ran longer than allowed and was given up. */
        TIMED_OUT;

        /** True when the pass moved the calendar forward. */
        public boolean isSuccess() {
            return this == COMPLETED || this == PARTIAL;
        }
    }

    /** A pass whose outcome follows from what it did. */
    public ReleaseRefreshRun(UUID id, Instant startedAt, Instant finishedAt, Origin origin, int stale, int refreshed,
                             boolean stoppedOnUnavailableProvider, String error) {
        this(id, startedAt, finishedAt, origin, stale, refreshed, stoppedOnUnavailableProvider, error,
                outcomeOf(stale, refreshed, stoppedOnUnavailableProvider, error));
    }

    /** How many items are still due after this pass. */
    public int remaining() {
        return Math.max(0, stale - refreshed);
    }

    public static Outcome outcomeOf(int stale, int refreshed, boolean providerSilent, String error) {
        if (error != null) {
            return Outcome.FAILED;
        }
        if (!providerSilent) {
            return Outcome.COMPLETED;
        }
        return refreshed > 0 ? Outcome.PARTIAL : Outcome.PROVIDER_SILENT;
    }
}
