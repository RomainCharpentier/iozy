package com.iozycore.core.domain.share;

import java.util.Optional;

/**
 * Port for space sharing. A single row (single-user application, see
 * {@link com.iozycore.core.domain.shared.DefaultOwner}), so {@link #find()} without
 * arguments, like the other settings of the project.
 */
public interface ShareSettingsRepository {

    /** The current settings, or the "no link" state if nothing was ever created. */
    ShareSettings find();

    ShareSettings save(ShareSettings settings);

    /**
     * The only entry point of public reading: resolves a token, or nothing.
     * A null, empty or revoked token must NEVER fall back to the owner's
     * row (whose token field is null once the link is deleted).
     */
    Optional<ShareSettings> findByToken(String token);

}
