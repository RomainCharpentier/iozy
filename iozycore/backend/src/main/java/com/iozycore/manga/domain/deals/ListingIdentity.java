package com.iozycore.manga.domain.deals;

import java.net.URI;
import java.util.Locale;
import com.iozycore.core.listing.ListingPlatform;

/**
 * Recognising that we are looking at <b>the same listing twice</b>.
 *
 * <h2>What it is exactly for</h2>
 * A listing analysed three times does not make three sellers. Without identity,
 * it would inflate the sample and push a reference to HIGH on a
 * single offer - the opposite of what a sample means. It is also what
 * allows us to exclude the listing being assessed from its own reference.
 *
 * <h2>In order of preference</h2>
 * <ol>
 *   <li>The <b>identifier of the source</b> when it gives one. On Vinted it
 *       is read in the page and does not depend on the slug: two links to the same
 *       listing, with or without a title in the URL, give the same identifier.</li>
 *   <li>Otherwise the <b>normalised URL</b> - host in lower case, without {@code www.},
 *       without tracking parameters, anchor or final slash. Weak but
 *       honest: if the source rewrites its URLs, deduplication fails, and missing
 *       a deduplication is better than merging two distinct listings.</li>
 *   <li>Otherwise <b>nothing</b>. A manual entry has no listing behind it;
 *       each observation then counts as one comparable, which is the very meaning
 *       of an observation typed by hand.</li>
 * </ol>
 *
 * <h2>Pure domain</h2>
 * A function on strings. No network access: this class never visits
 * the URL it normalises.
 */
public final class ListingIdentity {

    private ListingIdentity() {
    }

    /**
     * @param platform   the source, which prefixes the identifier so that a Vinted "12345"
     *                   never meets a "12345" from elsewhere
     * @param externalId identifier at the source, or {@code null}
     * @param url        link of the listing, or {@code null}
     * @return the identity, or {@code null} when no deduplication is possible
     */
    public static String of(ListingPlatform platform, String externalId, String url) {
        String source = platform == null ? ListingPlatform.OTHER.name() : platform.name();
        if (externalId != null && !externalId.isBlank()) {
            return source + ":" + externalId.trim();
        }
        String normalisee = normaliserUrl(url);
        return normalisee == null ? null : source + ":url:" + normalisee;
    }

    /**
     * Reduces a URL to what designates the listing.
     * <p>
     * The query parameters are removed entirely rather than filtered one by
     * one: on the target marketplaces they carry tracking
     * (<i>referrer</i>, campaign, position in a list), never the identity of
     * the listing, which lives in the path. Removing too little would make
     * two links to the same listing pass for two listings.
     */
    static String normaliserUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(url.trim());
            String hote = uri.getHost();
            if (hote == null) {
                return null;
            }
            hote = hote.toLowerCase(Locale.ROOT);
            if (hote.startsWith("www.")) {
                hote = hote.substring(4);
            }
            String chemin = uri.getPath() == null ? "" : uri.getPath();
            while (chemin.endsWith("/")) {
                chemin = chemin.substring(0, chemin.length() - 1);
            }
            return chemin.isEmpty() ? hote : hote + chemin;
        } catch (IllegalArgumentException e) {
            // A URL that cannot be used is worth no more than no URL: we
            // do not deduplicate rather than deduplicate wrongly.
            return null;
        }
    }
}
