package com.iozycore.core.domain.share;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

/**
 * The gift list (lot 217): a public link that shows the wishes only, and
 * expires {@link #LIFETIME} after it was issued or last renewed.
 *
 * <h2>Why it expires</h2>
 * A gift list is sent for an occasion (a birthday, the holidays) to people
 * who may forward it. Thirty days covers the occasion; after that the link
 * stops answering without the owner having to remember it. Renewing gives
 * thirty more days and keeps the same token, so a list already sent keeps
 * working.
 *
 * <h2>The token acts as a password</h2>
 * Same rules as the calendar link: 32 random bytes from a secure generator,
 * url-safe base64, looked up by its SHA-256 hash and compared in constant time.
 */
public record GiftLink(UUID id, UUID ownerId, String token, Instant createdAt, Instant expiresAt) {

    /** How long a gift link answers after it was issued or renewed. */
    public static final Duration LIFETIME = Duration.ofDays(30);
    /** A token longer than this is not one: answered without touching the database. */
    public static final int MAX_TOKEN_LENGTH = 128;

    private static final int TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    public GiftLink {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(ownerId, "ownerId");
        Objects.requireNonNull(token, "token");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(expiresAt, "expiresAt");
    }

    /** A brand new link for this owner, valid for {@link #LIFETIME}. */
    public static GiftLink issue(UUID ownerId, Instant now) {
        byte[] secret = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(secret);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
        return new GiftLink(UUID.randomUUID(), ownerId, token, now, now.plus(LIFETIME));
    }

    public static GiftLink reconstitute(UUID id, UUID ownerId, String token, Instant createdAt, Instant expiresAt) {
        return new GiftLink(id, ownerId, token, createdAt, expiresAt);
    }

    /** The same link, valid for {@link #LIFETIME} from now. Expired or not, the token stays. */
    public GiftLink renewed(Instant now) {
        return new GiftLink(id, ownerId, token, createdAt, now.plus(LIFETIME));
    }

    /** Expired at {@code expiresAt} itself: the thirtieth day ends there. */
    public boolean isExpiredAt(Instant now) {
        return !now.isBefore(expiresAt);
    }

    public String tokenHash() {
        return hashOf(token);
    }

    /** Constant time over the content: {@link MessageDigest#isEqual} does not stop at the first different byte. */
    public boolean matches(String candidate) {
        if (candidate == null) {
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
            throw new IllegalStateException(e);
        }
    }

    /** Never the token: a record's default toString would write it into any log line. */
    @Override
    public String toString() {
        return "GiftLink[id=" + id + ", ownerId=" + ownerId + ", expiresAt=" + expiresAt + "]";
    }
}
