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
 * Counts attempts per key, and says when a key must wait.
 *
 * <p>Used for passwords at sign-in (key: address and IP) and for invitation
 * codes at account creation (key: IP). The caller asks {@link #tryAcquire}
 * before it checks anything: the attempt is counted at once, in one atomic
 * step, so parallel requests cannot all pass before the first failure is
 * recorded. A success clears the key; an outcome that is not a guess gives
 * the attempt back with {@link #release}.
 *
 * <p>After {@code maxFailures} attempts inside {@code window}, the key is
 * blocked until the window of its first attempt ends.
 *
 * <p>In memory on purpose: one instance, no new dependency. A restart clears
 * every count, which is acceptable for a brake. The map is bounded: when it is
 * full, expired keys go first, then the oldest ones.
 */
@Component
public class FailedAttemptThrottle {

    private record Attempts(Instant first, int count) {
    }

    private final int maxFailures;
    private final Duration window;
    private final int maxKeys;
    private final Clock clock;
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

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

    /**
     * Counts one attempt for this key. Returns false, and counts nothing, when
     * the key has already used all its attempts in the current window.
     */
    public boolean tryAcquire(String key) {
        Instant now = clock.instant();
        if (!attempts.containsKey(key) && attempts.size() >= maxKeys) {
            makeRoom(now);
        }
        boolean[] acquired = {false};
        attempts.compute(key, (k, current) -> {
            if (current == null || isExpired(current, now)) {
                acquired[0] = true;
                return new Attempts(now, 1);
            }
            if (current.count() >= maxFailures) {
                return current;
            }
            acquired[0] = true;
            return new Attempts(current.first(), current.count() + 1);
        });
        return acquired[0];
    }

    /** Gives back one attempt, for an outcome that was not a guess. */
    public void release(String key) {
        attempts.computeIfPresent(key, (k, current) ->
                current.count() <= 1 ? null : new Attempts(current.first(), current.count() - 1));
    }

    /** A success: the key starts again from zero. */
    public void recordSuccess(String key) {
        attempts.remove(key);
    }

    /** True if this key has used all its attempts and must wait. */
    boolean isBlocked(String key) {
        Attempts current = attempts.get(key);
        return current != null && !isExpired(current, clock.instant()) && current.count() >= maxFailures;
    }

    int size() {
        return attempts.size();
    }

    private boolean isExpired(Attempts current, Instant now) {
        return !now.isBefore(current.first().plus(window));
    }

    private void makeRoom(Instant now) {
        attempts.entrySet().removeIf(entry -> isExpired(entry.getValue(), now));
        if (attempts.size() < maxKeys) {
            return;
        }
        // Still full: drop the oldest key. Linear, but only reached under a flood.
        String oldest = null;
        Instant oldestTime = null;
        for (Iterator<Map.Entry<String, Attempts>> it = attempts.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, Attempts> entry = it.next();
            if (oldestTime == null || entry.getValue().first().isBefore(oldestTime)) {
                oldest = entry.getKey();
                oldestTime = entry.getValue().first();
            }
        }
        if (oldest != null) {
            attempts.remove(oldest);
        }
    }
}
