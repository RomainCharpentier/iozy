package com.iozycore.core.domain.calendar;

import java.time.Instant;
import java.util.Optional;

/** The calendar subscription links. Every method but {@link #findActiveByToken} works for the current owner. */
public interface CalendarSubscriptionRepository {

    /** The active link of the current owner, if there is one. */
    Optional<CalendarSubscription> findActive();

    /**
     * Saves this new link, unless the owner already has an active one (two clicks
     * at the same moment): then nothing is written. Returns the active link in both cases.
     */
    CalendarSubscription saveIfNoneActive(CalendarSubscription subscription);

    /** Revokes the active link of the current owner. Nothing to revoke is not an error. */
    void revokeActive(Instant at);

    /**
     * The active link that holds this token, whoever owns it: the only lookup
     * that crosses owners, for the public feed. Empty for an unknown or revoked
     * token. The token is compared in constant time ({@link CalendarSubscription#matches}).
     */
    Optional<CalendarSubscription> findActiveByToken(String token);
}
