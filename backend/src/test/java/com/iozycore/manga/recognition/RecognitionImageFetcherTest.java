package com.iozycore.manga.recognition;

import com.iozycore.core.listing.ListingProvider;
import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingPlatform;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The anti-SSRF barrier. An endpoint that accepts a URL and fetches it
 * on the server side is a classic attack vector: you give it
 * {@code http://169.254.169.254/} and it brings back the credentials of the
 * host machine.
 *
 * <p>These tests open no connection: they check that <b>nothing is
 * even attempted</b> outside the whitelist. This is precisely the place where a
 * test that let a real call through would be the most dangerous.
 */
class RecognitionImageFetcherTest {

    /** A provider that declares an image CDN, as Vinted does. */
    private static class ProviderAvecImages implements ListingProvider {
        @Override
        public ListingPlatform platform() {
            return ListingPlatform.OTHER;
        }

        @Override
        public boolean supports(String url) {
            return false;
        }

        @Override
        public Set<String> allowedHosts() {
            return Set.of("pages-de-test.invalid");
        }

        @Override
        public Set<String> allowedImageHosts() {
            return Set.of("images-de-test.invalid");
        }

        @Override
        public ListingResolution resolve(String url) {
            return ListingResolution.failed(ListingResolution.Status.UNSUPPORTED_SOURCE, ListingPlatform.OTHER, url);
        }
    }

    /** A provider that does not say anything: it therefore allows no image. */
    private static class ProviderSansImages implements ListingProvider {
        @Override
        public ListingPlatform platform() {
            return ListingPlatform.OTHER;
        }

        @Override
        public boolean supports(String url) {
            return false;
        }

        @Override
        public Set<String> allowedHosts() {
            return Set.of("autre-page.invalid");
        }

        @Override
        public ListingResolution resolve(String url) {
            return ListingResolution.failed(ListingResolution.Status.UNSUPPORTED_SOURCE, ListingPlatform.OTHER, url);
        }
    }

    @Test
    void the_allowlist_is_assembled_only_from_what_providers_declare() {
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.allowedImageHosts()).containsExactly("images-de-test.invalid");
    }

    @Test
    void a_provider_that_says_nothing_grants_no_image_host() {
        // The default is empty: a provider never inherits a permission
        // that it did not ask for.
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderSansImages()));

        assertThat(fetcher.allowedImageHosts()).isEmpty();
    }

    @Test
    void page_hosts_never_become_image_hosts() {
        // Reading an HTML page and downloading a binary do not present the same
        // risk: allowing one must never allow the other.
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.allowedImageHosts()).doesNotContain("pages-de-test.invalid");
    }

    @Test
    void with_no_provider_at_all_nothing_can_be_downloaded() {
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of());

        assertThat(fetcher.allowedImageHosts()).isEmpty();
        assertThat(fetcher.fetch(List.of("https://images-de-test.invalid/1.jpg"))).isEmpty();
    }

    @Test
    void an_arbitrary_external_url_is_refused_without_any_network_call() {
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.fetch(List.of("https://attaquant.invalid/charge-utile.jpg"))).isEmpty();
    }

    @Test
    void the_cloud_metadata_endpoint_is_refused() {
        // 169.254.169.254 returns the credentials of the machine at the
        // main hosting providers. Refused twice: outside the whitelist, AND
        // link-local address.
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.fetch(List.of("https://169.254.169.254/latest/meta-data/"))).isEmpty();
    }

    @Test
    void localhost_and_private_ranges_are_refused() {
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.fetch(List.of(
                "https://127.0.0.1/interne.jpg",
                "https://localhost/interne.jpg",
                "https://192.168.1.1/routeur.jpg",
                "https://10.0.0.1/interne.jpg"))).isEmpty();
    }

    @Test
    void plain_http_is_refused_even_on_an_allowed_host() {
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.fetch(List.of("http://images-de-test.invalid/1.jpg"))).isEmpty();
    }

    @Test
    void a_host_that_merely_contains_an_allowed_name_is_refused() {
        // images-de-test.invalid.attaquant.example must never pass for
        // images-de-test.invalid: the comparison is exact, never "contains".
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.fetch(List.of(
                "https://images-de-test.invalid.attaquant.example/1.jpg",
                "https://attaquant.example/images-de-test.invalid/1.jpg"))).isEmpty();
    }

    @Test
    void a_file_url_is_refused() {
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.fetch(List.of("file:///etc/passwd"))).isEmpty();
    }

    @Test
    void nothing_to_fetch_is_not_an_error() {
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderAvecImages()));

        assertThat(fetcher.fetch(null)).isEmpty();
        assertThat(fetcher.fetch(List.of())).isEmpty();
    }

    @Test
    void the_real_vinted_provider_declares_its_image_cdn_and_only_that() {
        com.iozycore.core.listing.vinted.VintedListingProvider vinted =
                new com.iozycore.core.listing.vinted.VintedListingProvider(null);

        assertThat(vinted.allowedImageHosts()).contains("images1.vinted.net");
        // Page domains are not image hosts.
        assertThat(vinted.allowedImageHosts()).doesNotContain("vinted.fr", "www.vinted.fr");
        assertThat(vinted.allowedImageHosts()).allSatisfy(host -> assertThat(host).endsWith(".vinted.net"));
    }
}
