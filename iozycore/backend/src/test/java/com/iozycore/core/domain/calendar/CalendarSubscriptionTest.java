package com.iozycore.core.domain.calendar;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CalendarSubscriptionTest {

    private static final UUID OWNER = UUID.randomUUID();

    @Test
    void a_token_is_32_random_bytes_in_url_safe_base64() {
        CalendarSubscription subscription = CalendarSubscription.issue(OWNER, Instant.now());

        assertThat(subscription.token()).hasSize(CalendarSubscription.TOKEN_LENGTH).matches("[A-Za-z0-9_-]+");
        assertThat(subscription.token()).doesNotContain(OWNER.toString());
        assertThat(subscription.isActive()).isTrue();
    }

    @Test
    void two_links_never_share_a_token() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            tokens.add(CalendarSubscription.issue(OWNER, Instant.now()).token());
        }
        assertThat(tokens).hasSize(200);
    }

    @Test
    void matches_only_its_own_token_and_only_while_active() {
        CalendarSubscription subscription = CalendarSubscription.issue(OWNER, Instant.now());
        String token = subscription.token();

        assertThat(subscription.matches(token)).isTrue();
        assertThat(subscription.matches(token.substring(1))).isFalse();
        assertThat(subscription.matches(token + "x")).isFalse();
        assertThat(subscription.matches(null)).isFalse();

        CalendarSubscription revoked = CalendarSubscription.reconstitute(subscription.id(), OWNER, token,
                subscription.createdAt(), Instant.now());
        assertThat(revoked.matches(token)).isFalse();
    }

    @Test
    void the_hash_is_a_64_character_sha256_that_never_is_the_token() {
        CalendarSubscription subscription = CalendarSubscription.issue(OWNER, Instant.now());

        assertThat(subscription.tokenHash()).hasSize(64).matches("[0-9a-f]+").isNotEqualTo(subscription.token());
        assertThat(CalendarSubscription.hashOf("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void its_text_form_never_carries_the_token() {
        CalendarSubscription subscription = CalendarSubscription.issue(OWNER, Instant.now());

        assertThat(subscription.toString()).doesNotContain(subscription.token());
    }
}
