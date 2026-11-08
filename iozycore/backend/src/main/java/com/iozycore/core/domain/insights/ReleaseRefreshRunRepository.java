package com.iozycore.core.domain.insights;

import java.util.Optional;

/** Port: where the passes of the release refresh are recorded. Not owner-scoped: the refresh works on the shared catalog. */
public interface ReleaseRefreshRunRepository {

    ReleaseRefreshRun save(ReleaseRefreshRun run);

    /** The pass that ended last, whoever started it. */
    Optional<ReleaseRefreshRun> findLatest();

    /** The pass that ended last among those that moved the calendar forward (see {@link ReleaseRefreshRun.Outcome#isSuccess}). */
    Optional<ReleaseRefreshRun> findLatestSuccessful();
}
