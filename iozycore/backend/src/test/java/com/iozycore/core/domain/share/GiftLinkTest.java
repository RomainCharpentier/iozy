package com.iozycore.core.domain.share;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class GiftLinkTest {

    private final Instant now = Instant.parse("2026-11-09T10:00:00Z");

    @Test
    void a_new_link_answers_for_thirty_days_then_expires() {
        GiftLink link = GiftLink.issue(UUID.randomUUID(), now);

        assertThat(link.expiresAt()).isEqualTo(now.plus(Duration.ofDays(30)));
        assertThat(link.isExpiredAt(now.plus(Duration.ofDays(29)))).isFalse();
        assertThat(link.isExpiredAt(now.plus(Duration.ofDays(30)))).isTrue();
    }

    @Test
    void renewing_gives_thirty_more_days_and_keeps_the_token() {
        GiftLink link = GiftLink.issue(UUID.randomUUID(), now);
        Instant later = now.plus(Duration.ofDays(40));

        GiftLink renewed = link.renewed(later);

        assertThat(renewed.token()).isEqualTo(link.token());
        assertThat(renewed.expiresAt()).isEqualTo(later.plus(Duration.ofDays(30)));
        assertThat(renewed.isExpiredAt(later)).isFalse();
    }

    @Test
    void the_token_is_long_random_and_never_written_by_toString() {
        GiftLink first = GiftLink.issue(UUID.randomUUID(), now);
        GiftLink second = GiftLink.issue(UUID.randomUUID(), now);

        assertThat(first.token()).hasSize(43).isNotEqualTo(second.token());
        assertThat(first.matches(first.token())).isTrue();
        assertThat(first.matches(second.token())).isFalse();
        assertThat(first.matches(null)).isFalse();
        assertThat(first.toString()).doesNotContain(first.token());
    }
}
