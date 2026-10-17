package com.iozycore.core.listing;


import java.util.Set;

/**
 * A source of listings that IozyCore knows how to read.
 * <p>
 * The abstraction stays deliberately tiny - it exists so that adding
 * Leboncoin tomorrow is one more class and nothing else, not to build
 * a generic extraction engine. Three responsibilities, not one more:
 * say which platform it is, declare the hosts it allows, and
 * return a normalized {@link ListingSnapshot}.
 * <p>
 * <b>Each provider brings its own hosts</b> ({@link #allowedHosts()}):
 * none inherits the whitelist of another, and there is no global
 * list. Adding a provider therefore never widens what the others can
 * reach.
 */
public interface ListingProvider {

    /** The platform covered - it is what we then find on the saved analysis. */
    ListingPlatform platform();

    /** True if this URL belongs to this provider. Used for source detection, before any fetching. */
    boolean supports(String url);

    /**
     * Exact hosts, in lower case, that this provider allows the server to
     * reach. Strict whitelist: everything that is not in it is refused
     * before any network call (see {@link ListingUrlGuard}).
     */
    Set<String> allowedHosts();

    /**
     * Exact hosts, in lower case, from which the server can download
     * the <b>photos</b> of a listing from this source - typically an image
     * CDN, different from the page hosts.
     * <p>
     * Deliberately separate from {@link #allowedHosts()}: reading an HTML page and
     * downloading a binary do not present the same risk, and a provider
     * must be able to allow one without the other. The default is <b>empty</b> -
     * a provider that does not say anything allows no image
     * download, rather than inheriting a permission it did not ask for.
     * @see com.iozycore.manga.recognition.RecognitionImageFetcher
     */
    default Set<String> allowedImageHosts() {
        return Set.of();
    }

    /**
     * Reads the listing, or says why it could not be read.
     * <p>
     * Does not throw an exception for an expected failure (deleted listing, source
     * unavailable, unreadable page): these are normal outcomes of the flow,
     * that the user must be able to get past by typing by hand.
     */
    ListingResolution resolve(String url);
}
