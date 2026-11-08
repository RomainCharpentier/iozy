package com.iozycore.core.domain.calendar;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

/**
 * A secret link to subscribe to the release calendar from an agenda app
 * (Google Agenda, Apple Calendrier) - lot 215.
 *
 * <h2>The token acts as a password</h2>
 * An agenda app has no session: it calls the link again every few hours, and
 * having the link is enough. So the token is 32 random bytes from a secure
 * generator, written in url-safe base64 (43 characters), never derived from
 * the owner. It is looked up by its SHA-256 hash, then compared in constant
 * time ({@link #matches}): the time an answer takes says nothing about how
 * close a guess was.
 *
 * <h2>Revoking is final</h2>
 * A revoked link never works again; subscribing again draws a new token.
 */
public record CalendarSubscription(UUID id, UUID ownerId, String token, Instant createdAt, Instant revokedAt) {

    /** 32 bytes: 256 bits of secret, out of reach of any enumeration. */
    static final int TOKEN_BYTES = 32;
    /** The length of a token this class draws (url-safe base64 of 32 bytes, no padding). */
    public static final int TOKEN_LENGTH = 43;

    private static final SecureRandom RANDOM = new SecureRandom();

    public CalendarSubscription {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(ownerId, "ownerId");
        Objects.requireNonNull(token, "token");
        Objects.requireNonNull(createdAt, "createdAt");
    }

    /** A brand new active link for this owner. */
    public static CalendarSubscription issue(UUID ownerId, Instant now) {
        byte[] secret = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(secret);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        return new CalendarSubscription(UUID.randomUUID(), ownerId, token, now, null);
    }

    public static CalendarSubscription reconstitute(UUID id, UUID ownerId, String token, Instant createdAt,
                                                    Instant revokedAt) {
        return new CalendarSubscription(id, ownerId, token, createdAt, revokedAt);
    }

    public boolean isActive() {
        return revokedAt == null;
    }

    /** What the public lookup searches by: the token itself never goes into a WHERE clause. */
    public String tokenHash() {
        return hashOf(token);
    }

    /**
     * True when the candidate is this link's token and the link is still active.
     * Constant time over the content: {@link MessageDigest#isEqual} does not stop
     * at the first different byte.
     */
    public boolean matches(String candidate) {
        if (candidate == null || !isActive()) {
            return false;
        }
        return MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),
                candidate.getBytes(StandardCharsets.UTF_8));
    }

    /** SHA-256 in lower-case hex: 64 characters. */
    public static String hashOf(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // Every Java runtime ships SHA-256.
            throw new IllegalStateException(e);
        }
    }

    /** Never the token: a record's default toString would write it into any log line. */
    @Override
    public String toString() {
        return "CalendarSubscription[id=" + id + ", ownerId=" + ownerId + ", active=" + isActive() + "]";
    }
}
