package com.iozycore.recognition;

import com.iozycore.listing.ListingProvider;
import com.iozycore.listing.ListingResolution;
import com.iozycore.purchaseanalysis.ListingPlatform;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La barrière anti-SSRF. Un endpoint qui accepte une URL et va la chercher
 * côté serveur est un vecteur d'attaque classique : on lui donne
 * {@code http://169.254.169.254/} et il rapporte les identifiants de la
 * machine hôte.
 *
 * <p>Ces tests n'ouvrent aucune connexion : ils vérifient que <b>rien n'est
 * même tenté</b> hors de la liste blanche. C'est justement l'endroit où un
 * test qui laisserait passer un appel réel serait le plus dangereux.
 */
class RecognitionImageFetcherTest {

    /** Un provider qui déclare un CDN d'images, comme le fait Vinted. */
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

    /** Un provider qui ne se prononce pas : il n'autorise donc aucune image. */
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
        // Le défaut est vide : un provider n'hérite jamais d'une permission
        // qu'il n'a pas demandée.
        RecognitionImageFetcher fetcher = new RecognitionImageFetcher(List.of(new ProviderSansImages()));

        assertThat(fetcher.allowedImageHosts()).isEmpty();
    }

    @Test
    void page_hosts_never_become_image_hosts() {
        // Lire une page HTML et télécharger un binaire ne présentent pas le même
        // risque : autoriser l'un ne doit jamais autoriser l'autre.
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
        // 169.254.169.254 rend les identifiants de la machine chez les
        // principaux hébergeurs. Refusé deux fois : hors liste blanche, ET
        // adresse de lien-local.
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
        // images-de-test.invalid.attaquant.example ne doit jamais passer pour
        // images-de-test.invalid : la comparaison est exacte, jamais « contient ».
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
        com.iozycore.listing.vinted.VintedListingProvider vinted =
                new com.iozycore.listing.vinted.VintedListingProvider(null);

        assertThat(vinted.allowedImageHosts()).contains("images1.vinted.net");
        // Les domaines de pages ne sont pas des hôtes d'images.
        assertThat(vinted.allowedImageHosts()).doesNotContain("vinted.fr", "www.vinted.fr");
        assertThat(vinted.allowedImageHosts()).allSatisfy(host -> assertThat(host).endsWith(".vinted.net"));
    }
}
