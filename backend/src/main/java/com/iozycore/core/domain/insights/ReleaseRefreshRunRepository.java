package com.iozycore.core.domain.insights;

import java.util.Optional;

/** Port: where the passes of the release refresh are recorded. Not owner-scoped: the refresh works on the shared catalog. */
public interface ReleaseRefreshRunRepository {

    ReleaseRefreshRun save(ReleaseRefreshRun run);

    /** The most recent pass, whoever started it. */
    Optional<ReleaseRefreshRun> findLatest();
}
