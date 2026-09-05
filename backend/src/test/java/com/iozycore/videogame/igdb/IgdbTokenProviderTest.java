package com.iozycore.videogame.igdb;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Teste uniquement la logique pure d'expiration (getAccessToken() lui-même
 * fait un appel réseau à Twitch, jamais exercé en test - même principe que
 * les autres providers de métadonnées : voir JikanMetadataProviderTest).
 */
class IgdbTokenProviderTest {

    @Test
    void a_token_with_no_expiry_recorded_yet_is_considered_expired() {
        assertThat(IgdbTokenProvider.isExpired(null, Instant.now())).isTrue();
    }

    @Test
    void a_token_expiring_well_in_the_future_is_not_expired() {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(3600);

        assertThat(IgdbTokenProvider.isExpired(expiresAt, now)).isFalse();
    }

    @Test
    void a_token_within_the_safety_margin_is_considered_expired() {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(30); // < marge de sécurité de 60s

        assertThat(IgdbTokenProvider.isExpired(expiresAt, now)).isTrue();
    }

    @Test
    void a_token_already_in_the_past_is_expired() {
        Instant now = Instant.now();
        Instant expiresAt = now.minusSeconds(10);

        assertThat(IgdbTokenProvider.isExpired(expiresAt, now)).isTrue();
    }
}
