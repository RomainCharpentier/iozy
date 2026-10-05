package com.iozycore.core.listing;

import com.iozycore.core.listing.ListingPlatform;

import java.util.Optional;

/**
 * The outcome of an attempt to read a listing.
 * <p>
 * There is much more than "it worked" and "it failed": half of
 * the value of this module is to tell apart situations to which
 * the user does not react in the same way - a platform not yet
 * supported is not a deleted listing, which is not a temporary
 * block. A single error code would produce the same useless message in
 * the three cases.
 * <p>
 * <b>A partial result is a success.</b> Title and price read but photos
 * unreadable: {@link Status#PARTIAL}, with the snapshot filled with what was
 * found. It is not an error, it is less work for
 * the user.
 */
public record ListingResolution(Status status, ListingPlatform source, String url, ListingSnapshot snapshot) {

    public enum Status {
        /** Everything the provider can read has been read. */
        SUCCESS,
        /** Only a part was read - the rest is still to be typed by hand. */
        PARTIAL,
        /** Unusable URL: not absolute, not HTTPS, or host refused by the whitelist. */
        INVALID_URL,
        /** Valid URL but no known source covers it - the manual flow continues, the URL is kept. */
        UNSUPPORTED_SOURCE,
        /**
         * <b>Recognized</b> source, but which refuses automatic reading.
         *
         * <p>To be told apart from {@link #UNSUPPORTED_SOURCE} ("nobody covers
         * this URL", so a support may come) and from
         * {@link #UNAVAILABLE} ("it did not work this time", so
         * retrying makes sense). Here, neither: the platform
         * protects itself against robots, and no amount of code will change
         * that without crossing a line that this project does not cross - no
         * user cookie, no private API, no anti-bot workaround.
         *
         * <p>Saying it explicitly avoids letting people believe in a
         * feature "not yet" delivered: manual entry is not
         * a temporary fallback, it is the flow for this source.
         */
        SOURCE_BLOCKS_AUTOMATION,
        /** The listing no longer exists, or never existed. */
        LISTING_NOT_FOUND,
        /** The source delivered nothing usable: blocking, outage, unreadable page. Retrying later may work. */
        UNAVAILABLE
    }

    public static ListingResolution success(ListingSnapshot snapshot) {
        return new ListingResolution(Status.SUCCESS, snapshot.source(), snapshot.sourceUrl(), snapshot);
    }

    public static ListingResolution partial(ListingSnapshot snapshot) {
        return new ListingResolution(Status.PARTIAL, snapshot.source(), snapshot.sourceUrl(), snapshot);
    }

    public static ListingResolution failed(Status status, ListingPlatform source, String url) {
        return new ListingResolution(status, source, url, null);
    }

    public Optional<ListingSnapshot> snapshotIfAny() {
        return Optional.ofNullable(snapshot);
    }

    /** True when something usable has been retrieved, complete or not. */
    public boolean hasData() {
        return snapshot != null && !snapshot.isEmpty();
    }
}
