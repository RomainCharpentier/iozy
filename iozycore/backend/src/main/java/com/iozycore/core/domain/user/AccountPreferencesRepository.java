package com.iozycore.core.domain.user;

/**
 * The preferences of the CURRENT account (the owner comes from the session,
 * like every private table). One row at most per account.
 */
public interface AccountPreferencesRepository {

    /** What the account chose, {@link AccountPreferences#NONE} when it never chose anything. */
    AccountPreferences find();

    /** Writes the whole set: the caller merges the change first. */
    AccountPreferences save(AccountPreferences preferences);
}
