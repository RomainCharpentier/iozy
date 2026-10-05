package com.iozycore.core.listing;

import com.iozycore.core.listing.ListingPlatform;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.List;
import java.util.Optional;

/**
 * Single entry point of the module: receives a URL pasted by the user,
 * finds the provider that covers it, and delegates the reading to it.
 * <p>
 * All the logic specific to a platform lives in its provider - there is here
 * neither {@code if (url.contains("vinted"))}, nor parsing, nor network call. Adding
 * Leboncoin will consist in publishing a second {@link ListingProvider}: Spring
 * will inject it into the list below and nothing else will move.
 * <p>
 * <b>An uncovered URL is not an error.</b> It returns
 * {@link ListingResolution.Status#UNSUPPORTED_SOURCE}, the URL is kept
 * as is, and the user types their listing by hand as before. The
 * link stays useful: it will allow finding the listing again from the saved
 * analysis.
 */
@Service
public class ListingSourceResolver {

    private final List<ListingProvider> providers;

    public ListingSourceResolver(List<ListingProvider> providers) {
        this.providers = providers;
    }

    /**
     * The platform recognized for this URL, without any network call -
     * it is what the form uses to announce "Detection: Vinted"
     * even before retrieving anything.
     */
    public ListingPlatform detectSource(String url) {
        return providerFor(url).map(ListingProvider::platform).orElse(ListingPlatform.OTHER);
    }

    /** Reads the listing if a source covers it, otherwise says so without trying anything. */
    public ListingResolution resolve(String url) {
        if (url == null || url.isBlank() || !isWellFormedHttps(url)) {
            return ListingResolution.failed(ListingResolution.Status.INVALID_URL, ListingPlatform.OTHER, url);
        }
        return providerFor(url)
                .map(provider -> provider.resolve(url))
                .orElseGet(() -> ListingResolution.failed(
                        ListingResolution.Status.UNSUPPORTED_SOURCE, ListingPlatform.OTHER, url.trim()));
    }

    private Optional<ListingProvider> providerFor(String url) {
        if (url == null || url.isBlank()) {
            return Optional.empty();
        }
        return providers.stream().filter(provider -> provider.supports(url)).findFirst();
    }

    /**
     * Immediate refusal of what is obviously not a consultable
     * web address: {@code file://}, {@code ftp://}, a relative address, free
     * text. The full check (whitelist, internal addresses) remains
     * the job of {@link ListingUrlGuard}, at fetching time -
     * this one only tells "invalid URL" apart from "unsupported
     * source", two different messages for the user.
     */
    private static boolean isWellFormedHttps(String url) {
        try {
            URI uri = new URI(url.trim());
            return uri.isAbsolute() && "https".equalsIgnoreCase(uri.getScheme())
                    && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (Exception e) {
            return false;
        }
    }
}
