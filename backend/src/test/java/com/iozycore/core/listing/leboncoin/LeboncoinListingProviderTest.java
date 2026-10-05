package com.iozycore.core.listing.leboncoin;

import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingPlatform;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Recognise without reading.
 *
 * <p>These tests protect two things of a different nature: the right message
 * (a source that refuses robots is not a "not yet supported"
 * source), and the <b>structural</b> impossibility of sending a request to
 * Leboncoin.
 */
class LeboncoinListingProviderTest {

    private final LeboncoinListingProvider provider = new LeboncoinListingProvider();

    // ====================================================== Recognition

    @Test
    void a_leboncoin_listing_is_recognised() {
        assertThat(provider.supports("https://www.leboncoin.fr/ad/livres/3252049142")).isTrue();
        assertThat(provider.supports("https://leboncoin.fr/ad/livres/123")).isTrue();
        assertThat(provider.supports("https://m.leboncoin.fr/ad/livres/123")).isTrue();
    }

    @Test
    void a_host_that_merely_contains_the_name_is_not_leboncoin() {
        // leboncoin.fr.attaquant.example must never pass for Leboncoin:
        // the comparison is on the exact host, never on "the URL contains".
        assertThat(provider.supports("https://leboncoin.fr.attaquant.example/ad/1")).isFalse();
        assertThat(provider.supports("https://attaquant.example/leboncoin.fr/ad/1")).isFalse();
        assertThat(provider.supports("https://notleboncoin.fr/ad/1")).isFalse();
    }

    @Test
    void another_platform_is_left_to_its_own_provider() {
        assertThat(provider.supports("https://www.vinted.fr/items/1")).isFalse();
        assertThat(provider.supports("https://exemple.invalid/annonce")).isFalse();
    }

    @Test
    void a_malformed_url_is_simply_not_recognised() {
        assertThat(provider.supports(null)).isFalse();
        assertThat(provider.supports("")).isFalse();
        assertThat(provider.supports("pas-une-url")).isFalse();
    }

    // ====================================================== The right message

    @Test
    void the_status_says_the_source_refuses_automation_not_that_support_is_missing() {
        ListingResolution resolution = provider.resolve("https://www.leboncoin.fr/ad/livres/3252049142");

        // UNSUPPORTED_SOURCE would read "not yet supported", and would make people
        // wait for a feature that will never come. UNAVAILABLE would
        // read "try again", which will never work.
        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.SOURCE_BLOCKS_AUTOMATION);
        assertThat(resolution.status()).isNotEqualTo(ListingResolution.Status.UNSUPPORTED_SOURCE);
        assertThat(resolution.status()).isNotEqualTo(ListingResolution.Status.UNAVAILABLE);
    }

    @Test
    void the_platform_is_named_and_the_link_is_kept() {
        String url = "https://www.leboncoin.fr/ad/livres/3252049142";

        ListingResolution resolution = provider.resolve(url);

        // The user must be able to find their listing: the link survives the failure.
        assertThat(resolution.source()).isEqualTo(ListingPlatform.LEBONCOIN);
        assertThat(resolution.url()).isEqualTo(url);
        assertThat(resolution.snapshot()).isNull();
    }

    // ====================================================== No request possible

    @Test
    void this_provider_authorises_the_server_to_reach_nothing() {
        // The heart of the matter: it recognises the source, it does not reach it. Even a
        // calling bug could not trigger a request to Leboncoin.
        assertThat(provider.allowedHosts()).isEmpty();
        assertThat(provider.allowedImageHosts()).isEmpty();
    }

    @Test
    void resolving_never_touches_the_network() {
        // No fetcher is injected: the class has no way of sending a
        // request, which is better than a promise not to.
        long debut = System.nanoTime();
        provider.resolve("https://www.leboncoin.fr/ad/livres/3252049142");
        long dureeMs = (System.nanoTime() - debut) / 1_000_000;

        assertThat(dureeMs).as("immediate response, so no network round trip").isLessThan(50);
    }
}
