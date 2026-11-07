package com.iozycore.core.api.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Counts failed attempts per key, and says when a key must wait.
 *
 * <p>Used for wrong passwords at sign-in (key: address and IP) and for wrong
 * invitation codes at account creation (key: IP). After {@code maxFailures}
 * failures inside {@code window}, the key is blocked until the window of its
 * first failure ends. A success clears the key.
 *
 * <p>In memory on purpose: one instance, no new dependency. A restart clears
 * every count, which is acceptable for a brake. The map is bounded: when it is
 * full, expired keys go first, then the oldest ones.
 */
@Component
public class FailedAttemptThrottle {

    private record Failures(Instant firstFailure, int count) {
    }

    private final int maxFailures;
    private final Duration window;
    private final int maxKeys;
    private final Clock clock;
    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    @Autowired
    public FailedAttemptThrottle(@Value("${auth.throttle.max-failures:5}") int maxFailures,
                                 @Value("${auth.throttle.window:PT15M}") Duration window,
                                 @Value("${auth.throttle.max-keys:10000}") int maxKeys) {
        this(maxFailures, window, maxKeys, Clock.systemUTC());
    }

    FailedAttemptThrottle(int maxFailures, Duration window, int maxKeys, Clock clock) {
        this.maxFailures = Math.max(1, maxFailures);
        this.window = window;
        this.maxKeys = Math.max(1, maxKeys);
        this.clock = clock;
    }

    /** True if this key has failed too often and must wait. */
    public boolean isBlocked(String key) {
        Failures current = failures.get(key);
        if (current == null) {
            return false;
        }
        if (isExpired(current, clock.instant())) {
            failures.remove(key, current);
            return false;
        }
        return current.count() >= maxFailures;
    }

    public void recordFailure(String key) {
        Instant now = clock.instant();
        if (!failures.containsKey(key) && failures.size() >= maxKeys) {
            makeRoom(now);
        }
        failures.compute(key, (k, current) -> current == null || isExpired(current, now)
                ? new Failures(now, 1)
                : new Failures(current.firstFailure(), current.count() + 1));
    }

    public void recordSuccess(String key) {
        failures.remove(key);
    }

    int size() {
        return failures.size();
    }

    private boolean isExpired(Failures current, Instant now) {
        return !now.isBefore(current.firstFailure().plus(window));
    }

    private void makeRoom(Instant now) {
        failures.entrySet().removeIf(entry -> isExpired(entry.getValue(), now));
        if (failures.size() < maxKeys) {
            return;
        }
        // Still full: drop the oldest key. Linear, but only reached under a flood.
        String oldest = null;
        Instant oldestTime = null;
        for (Iterator<Map.Entry<String, Failures>> it = failures.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, Failures> entry = it.next();
            if (oldestTime == null || entry.getValue().firstFailure().isBefore(oldestTime)) {
                oldest = entry.getKey();
                oldestTime = entry.getValue().firstFailure();
            }
        }
        if (oldest != null) {
            failures.remove(oldest);
        }
    }
}
