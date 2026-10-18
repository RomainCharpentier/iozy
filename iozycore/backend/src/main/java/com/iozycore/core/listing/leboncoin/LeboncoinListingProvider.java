package com.iozycore.core.listing.leboncoin;

import com.iozycore.core.listing.ListingProvider;
import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingPlatform;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Recognizes a Leboncoin listing - and says frankly that it cannot be
 * read automatically.
 *
 * <h2>Why a provider that reads nothing</h2>
 * Without it, a Leboncoin link comes out as {@code UNSUPPORTED_SOURCE}, from which
 * the screen draws "this platform is not yet fetched automatically".
 * This "not yet" makes people expect a feature to come. It will not come
 * that way, and making people believe so costs more than an admission.
 *
 * <h2>What was observed (2026-08-24)</h2>
 * The listing pages are protected by DataDome. A server request, without
 * a browser - exactly the profile of {@code ListingHttpFetcher} - receives an
 * <b>HTTP 403</b> of 771 bytes pointing to {@code captcha-delivery.com},
 * never the listing. An automated browser receives the same interstitial
 * page: empty title, no data, {@code og:image} served from
 * {@code img.datadome.co/captcha/...}. There is neither JSON-LD nor microdata to
 * read.
 *
 * <h2>What this provider will never do</h2>
 * Go around it. No session cookie, no private API, no browser
 * disguise, no CAPTCHA solving: these are lines that this project does not
 * cross, and an anti-robot protection is an explicit wish of the
 * publisher, not a technical obstacle to work around.
 *
 * <h2>No request, by construction</h2>
 * {@link #allowedHosts()} returns an <b>empty</b> set: this provider does not allow
 * the server to reach any host. Recognition goes through
 * {@link #supports(String)}, the reading does not take place. Even a calling bug
 * could not trigger a request to Leboncoin.
 *
 * <h2>The day this would change</h2>
 * If Leboncoin published an API or lifted the protection, this class would become
 * a real provider - same interface, same callers, no change
 * elsewhere. This is precisely what the {@code ListingProvider} seam allows.
 */
@Component
public class LeboncoinListingProvider implements ListingProvider {

    /**
     * Domains listed one by one, never deduced from a pattern like "everything
     * that contains leboncoin" - {@code leboncoin.fr.attaquant.example} must not
     * pass for Leboncoin. Same rule as for Vinted.
     */
    private static final Set<String> HOTES_RECONNUS = construireHotes();

    private static Set<String> construireHotes() {
        Set<String> hotes = new LinkedHashSet<>();
        for (String domaine : List.of("leboncoin.fr")) {
            hotes.add(domaine);
            hotes.add("www." + domaine);
            hotes.add("m." + domaine);
        }
        return Set.copyOf(hotes);
    }

    @Override
    public ListingPlatform platform() {
        return ListingPlatform.LEBONCOIN;
    }

    /**
     * Detection on the host alone, never on "the URL contains leboncoin".
     * Recognizing does not mean reading: see {@link #resolve(String)}.
     */
    @Override
    public boolean supports(String url) {
        return hote(url).map(HOTES_RECONNUS::contains).orElse(false);
    }

    /**
     * Empty, and this is the heart of the matter: this provider does not allow the server to
     * reach <b>any</b> host, since it reads nothing.
     */
    @Override
    public Set<String> allowedHosts() {
        return Set.of();
    }

    /** Without reading, no photos - so no image hosts either. */
    @Override
    public Set<String> allowedImageHosts() {
        return Set.of();
    }

    /**
     * Returns immediately, <b>without any network call</b>: the result is
     * known in advance, and asking the platform just to be refused
     * would teach nobody anything.
     */
    @Override
    public ListingResolution resolve(String url) {
        return ListingResolution.failed(ListingResolution.Status.SOURCE_BLOCKS_AUTOMATION,
                ListingPlatform.LEBONCOIN, url == null ? null : url.trim());
    }

    private static java.util.Optional<String> hote(String url) {
        if (url == null || url.isBlank()) {
            return java.util.Optional.empty();
        }
        try {
            java.net.URI uri = new java.net.URI(url.trim());
            return java.util.Optional.ofNullable(uri.getHost())
                    .map(h -> h.toLowerCase(java.util.Locale.ROOT));
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }
}
