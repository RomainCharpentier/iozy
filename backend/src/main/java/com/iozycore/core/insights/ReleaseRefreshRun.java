package com.iozycore.core.insights;

import java.time.Instant;
import java.util.UUID;

/**
 * One pass of the release refresh, as it was recorded.
 *
 * @param origin  who started it: the night job or a person
 * @param stale   items that were due for a re-read at the start of the pass
 * @param refreshed items re-read; {@code stale - refreshed} is what is still waiting
 * @param error   what went wrong when the pass failed, otherwise null
 */
public record ReleaseRefreshRun(UUID id, Instant startedAt, Instant finishedAt, Origin origin, int stale, int refreshed,
                                boolean stoppedOnUnavailableProvider, String error) {

    public enum Origin { SCHEDULED, MANUAL }

    /** How many items are still due after this pass. */
    public int remaining() {
        return Math.max(0, stale - refreshed);
    }
}
