package com.iozycore.core.api.auth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class FailedAttemptThrottleTest {

    /** A clock the test moves by hand. */
    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-11-08T10:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final MovableClock clock = new MovableClock();
    private final FailedAttemptThrottle throttle = new FailedAttemptThrottle(3, Duration.ofMinutes(15), 100, clock);

    @Test
    void a_key_is_blocked_after_the_maximum_number_of_failures() {
        throttle.recordFailure("a");
        throttle.recordFailure("a");
        assertThat(throttle.isBlocked("a")).isFalse();

        throttle.recordFailure("a");
        assertThat(throttle.isBlocked("a")).isTrue();
        assertThat(throttle.isBlocked("b")).isFalse();
    }

    @Test
    void the_block_ends_with_the_window() {
        for (int i = 0; i < 3; i++) {
            throttle.recordFailure("a");
        }
        clock.advance(Duration.ofMinutes(14));
        assertThat(throttle.isBlocked("a")).isTrue();

        clock.advance(Duration.ofMinutes(1));
        assertThat(throttle.isBlocked("a")).isFalse();
    }

    @Test
    void old_failures_do_not_add_up_with_new_ones() {
        throttle.recordFailure("a");
        throttle.recordFailure("a");
        clock.advance(Duration.ofMinutes(16));

        throttle.recordFailure("a");
        assertThat(throttle.isBlocked("a")).isFalse();
    }

    @Test
    void a_success_clears_the_count() {
        throttle.recordFailure("a");
        throttle.recordFailure("a");
        throttle.recordSuccess("a");

        throttle.recordFailure("a");
        assertThat(throttle.isBlocked("a")).isFalse();
    }

    @Test
    void the_map_never_grows_past_its_bound() {
        FailedAttemptThrottle small = new FailedAttemptThrottle(3, Duration.ofMinutes(15), 2, clock);
        small.recordFailure("a");
        clock.advance(Duration.ofSeconds(1));
        small.recordFailure("b");
        clock.advance(Duration.ofSeconds(1));
        small.recordFailure("c");

        assertThat(small.size()).isEqualTo(2);
    }
}
