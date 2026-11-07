package com.iozycore.core.api.auth;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
        throttle.tryAcquire("a");
        throttle.tryAcquire("a");
        assertThat(throttle.isBlocked("a")).isFalse();

        throttle.tryAcquire("a");
        assertThat(throttle.isBlocked("a")).isTrue();
        assertThat(throttle.isBlocked("b")).isFalse();
    }

    @Test
    void the_block_ends_with_the_window() {
        for (int i = 0; i < 3; i++) {
            throttle.tryAcquire("a");
        }
        clock.advance(Duration.ofMinutes(14));
        assertThat(throttle.isBlocked("a")).isTrue();

        clock.advance(Duration.ofMinutes(1));
        assertThat(throttle.isBlocked("a")).isFalse();
    }

    @Test
    void old_failures_do_not_add_up_with_new_ones() {
        throttle.tryAcquire("a");
        throttle.tryAcquire("a");
        clock.advance(Duration.ofMinutes(16));

        throttle.tryAcquire("a");
        assertThat(throttle.isBlocked("a")).isFalse();
    }

    @Test
    void a_success_clears_the_count() {
        throttle.tryAcquire("a");
        throttle.tryAcquire("a");
        throttle.recordSuccess("a");

        throttle.tryAcquire("a");
        assertThat(throttle.isBlocked("a")).isFalse();
    }

    @Test
    void the_map_never_grows_past_its_bound() {
        FailedAttemptThrottle small = new FailedAttemptThrottle(3, Duration.ofMinutes(15), 2, clock);
        small.tryAcquire("a");
        clock.advance(Duration.ofSeconds(1));
        small.tryAcquire("b");
        clock.advance(Duration.ofSeconds(1));
        small.tryAcquire("c");

        assertThat(small.size()).isEqualTo(2);
    }
    @Test
    void a_blocked_key_is_refused_and_not_counted_again() {
        for (int i = 0; i < 3; i++) {
            assertThat(throttle.tryAcquire("a")).isTrue();
        }
        assertThat(throttle.tryAcquire("a")).isFalse();
        // The window still runs from the first attempt, not from the refused ones.
        clock.advance(Duration.ofMinutes(15));
        assertThat(throttle.tryAcquire("a")).isTrue();
    }

    @Test
    void a_released_attempt_does_not_count() {
        throttle.tryAcquire("a");
        throttle.tryAcquire("a");
        throttle.tryAcquire("a");
        throttle.release("a");

        assertThat(throttle.isBlocked("a")).isFalse();
        assertThat(throttle.tryAcquire("a")).isTrue();
        assertThat(throttle.tryAcquire("a")).isFalse();
    }

    @Test
    void parallel_attempts_cannot_pass_the_limit() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(16);
        try {
            List<Callable<Boolean>> tries = new ArrayList<>();
            for (int i = 0; i < 200; i++) {
                tries.add(() -> throttle.tryAcquire("a"));
            }
            int acquired = 0;
            for (Future<Boolean> result : pool.invokeAll(tries)) {
                if (result.get()) {
                    acquired++;
                }
            }
            assertThat(acquired).isEqualTo(3);
        } finally {
            pool.shutdownNow();
        }
    }
}
