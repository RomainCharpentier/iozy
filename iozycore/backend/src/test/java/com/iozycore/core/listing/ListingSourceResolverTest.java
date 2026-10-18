package com.iozycore.core.listing;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Source detection and what happens when no source covers
 * the URL.
 * <p>
 * The provider here is a <b>fake</b> that records what it is asked: these
 * tests can therefore assert not only what the resolver answers, but
 * also that it <b>did not try to fetch anything</b> - this is the guarantee that
 * matters for an arbitrary URL.
 */
class ListingSourceResolverTest {

    /** Fake provider: covers a single host and notes each URL it is asked to read. */
    private static class ProviderFactice implements ListingProvider {
        private final List<String> urlsDemandees = new ArrayList<>();
        private ListingResolution reponse;

        @Override
        public ListingPlatform platform() {
            return ListingPlatform.VINTED;
        }

        @Override
        public boolean supports(String url) {
            return url != null && url.contains("//source-connue.test/");
        }

        @Override
        public Set<String> allowedHosts() {
            return Set.of("source-connue.test");
        }

        @Override
        public ListingResolution resolve(String url) {
            urlsDemandees.add(url);
            return reponse;
        }
    }

    private final ProviderFactice provider = new ProviderFactice();
    private final ListingSourceResolver resolver = new ListingSourceResolver(List.of(provider));

    @Test
    void detecte_la_source_sans_aucun_appel_reseau() {
        assertThat(resolver.detectSource("https://source-connue.test/items/1")).isEqualTo(ListingPlatform.VINTED);

        // Detection is used to announce "Détection : Vinted" before even
        // fetching anything: it must trigger nothing.
        assertThat(provider.urlsDemandees).isEmpty();
    }

    @Test
    void une_source_inconnue_n_est_pas_une_erreur_et_ne_declenche_aucune_recuperation() {
        ListingResolution resolution = resolver.resolve("https://une-autre-plateforme.test/annonce/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.UNSUPPORTED_SOURCE);
        assertThat(resolution.source()).isEqualTo(ListingPlatform.OTHER);
        // The URL is kept: it is used to find the listing again from the analysis.
        assertThat(resolution.url()).isEqualTo("https://une-autre-plateforme.test/annonce/42");
        assertThat(resolution.hasData()).isFalse();
        // THE security point: no arbitrary URL is ever followed.
        assertThat(provider.urlsDemandees).isEmpty();
    }

    @Test
    void une_url_interne_n_atteint_aucun_provider() {
        for (String interne : List.of("https://localhost:8080/api/entity-types", "https://127.0.0.1/",
                "https://169.254.169.254/latest/meta-data/", "https://192.168.0.1/")) {
            ListingResolution resolution = resolver.resolve(interne);
            assertThat(resolution.status()).isEqualTo(ListingResolution.Status.UNSUPPORTED_SOURCE);
        }
        assertThat(provider.urlsDemandees).isEmpty();
    }

    @Test
    void une_url_inexploitable_est_refusee_avant_toute_recherche_de_provider() {
        for (String invalide : List.of("file:///etc/passwd", "ftp://source-connue.test/x", "pas une url",
                "http://source-connue.test/items/1", "", "   ")) {
            assertThat(resolver.resolve(invalide).status())
                    .as(invalide)
                    .isEqualTo(ListingResolution.Status.INVALID_URL);
        }
        assertThat(provider.urlsDemandees).isEmpty();
    }

    @Test
    void delegue_au_provider_qui_couvre_l_url() {
        ListingSnapshot snapshot = new ListingSnapshot(ListingPlatform.VINTED,
                "https://source-connue.test/items/1", "1", "Un lot", null, new BigDecimal("70"), "EUR",
                null, ShippingEstimateKind.UNKNOWN, null, List.of(), Instant.now(),
                List.of(ListingSnapshot.ListingField.TITLE, ListingSnapshot.ListingField.PRICE));
        provider.reponse = ListingResolution.partial(snapshot);

        ListingResolution resolution = resolver.resolve("https://source-connue.test/items/1");

        assertThat(provider.urlsDemandees).containsExactly("https://source-connue.test/items/1");
        // A partial result is a usable success: title and price read, the
        // rest to be entered - not a failure.
        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.PARTIAL);
        assertThat(resolution.hasData()).isTrue();
        assertThat(resolution.snapshot().price()).isEqualByComparingTo(new BigDecimal("70"));
        assertThat(resolution.snapshot().description()).isNull();
        assertThat(resolution.snapshot().imageUrls()).isEmpty();
    }
}
