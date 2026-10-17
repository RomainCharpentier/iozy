package com.iozycore.core.application.insights;

/**
 * Extension point: a universe that keeps its release dates fresh by re-reading
 * its providers (the manga universe re-reads ongoing series, for instance).
 * {@link ReleaseRefreshService} runs every source, at night or on request, and
 * records each pass.
 *
 * <p>An implementation must never throw because a provider is silent: it stops
 * early and says so in its {@link Result}.
 */
public interface ReleaseRefreshSource {

    /** One pass of this source. */
    Result refresh();

    /**
     * @param stale                       how many items were due for a re-read at the start
     * @param refreshed                   how many were re-read (a pass is capped, so this can be lower)
     * @param stoppedOnUnavailableProvider a provider went silent and the pass stopped early
     */
    record Result(int stale, int refreshed, boolean stoppedOnUnavailableProvider) {
    }
}
