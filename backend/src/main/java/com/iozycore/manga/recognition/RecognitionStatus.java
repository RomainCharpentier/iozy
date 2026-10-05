package com.iozycore.manga.recognition;

/**
 * The outcome of a photo analysis. Named rather than reduced to a boolean:
 * "nothing recognised" and "engine down" call for different sentences on
 * screen, and only one of the two is worth trying again.
 *
 * <p>None of these outcomes is an API error: the route returns 200 in all
 * cases, like {@code POST /listing-metadata/resolve}. A red banner
 * would confuse "these photos show no readable volumes" with "the
 * service is broken".
 */
public enum RecognitionStatus {

    /** Everything that was visible was identified. */
    OK,

    /** One part identified, one part not - the most frequent case on a batch. */
    PARTIAL,

    /** The engine answered, but could not read anything on these photos. */
    NOTHING_RECOGNIZED,

    /** No usable photo: host not allowed, format refused, too heavy, unreadable. */
    NO_USABLE_IMAGE,

    /** No engine configured - IozyCore works without it, manual entry stays whole. */
    NO_ENGINE,

    /**
     * The service reached its quota - on the free tier, a token count
     * per day, which a shelf photo uses up quickly. Trying again within the minute
     * will give nothing: it is tomorrow, or the Catalogue by hand. Told apart from
     * UNAVAILABLE because the screen must say one and not the other.
     */
    QUOTA_EXCEEDED,

    /** The engine failed: failure, timeout. Trying again later makes sense. */
    UNAVAILABLE;

    /** True if trying again can give something different - used to decide to show "Réessayer". */
    public boolean worthRetrying() {
        return this == UNAVAILABLE;
    }
}
