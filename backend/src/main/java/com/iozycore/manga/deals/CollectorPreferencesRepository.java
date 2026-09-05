package com.iozycore.manga.deals;

/** Port for the single, mono-user {@link CollectorPreferences} row (see {@link com.iozycore.domain.shared.DefaultOwner}). */
public interface CollectorPreferencesRepository {

    /** Returns {@link CollectorPreferences#defaults()} the first time, before any explicit save. */
    CollectorPreferences find();

    CollectorPreferences save(CollectorPreferences preferences);
}
