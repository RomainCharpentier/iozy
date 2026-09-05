package com.iozycore.listing;

import com.iozycore.listing.ListingPlatform;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La détection de source et ce qui se passe quand aucune source ne couvre
 * l'URL.
 * <p>
 * Le provider est ici un <b>faux</b> qui enregistre ce qu'on lui demande : ces
 * tests peuvent donc affirmer non seulement ce que le résolveur répond, mais
 * aussi qu'il <b>n'a rien tenté d'aller chercher</b> - c'est la garantie qui
 * compte pour une URL arbitraire.
 */
class ListingSourceResolverTest {

    /** Faux provider : couvre un seul hôte et note chaque URL qu'on lui demande de lire. */
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

        // La détection sert à annoncer « Détection : Vinted » avant même de
        // récupérer quoi que ce soit : elle ne doit rien déclencher.
        assertThat(provider.urlsDemandees).isEmpty();
    }

    @Test
    void une_source_inconnue_n_est_pas_une_erreur_et_ne_declenche_aucune_recuperation() {
        ListingResolution resolution = resolver.resolve("https://une-autre-plateforme.test/annonce/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.UNSUPPORTED_SOURCE);
        assertThat(resolution.source()).isEqualTo(ListingPlatform.OTHER);
        // L'URL est conservée : elle sert à retrouver l'annonce depuis l'analyse.
        assertThat(resolution.url()).isEqualTo("https://une-autre-plateforme.test/annonce/42");
        assertThat(resolution.hasData()).isFalse();
        // LE point de sécurité : aucune URL arbitraire n'est jamais suivie.
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
        // Un résultat partiel est un succès utilisable : titre et prix lus, le
        // reste à saisir - pas un échec.
        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.PARTIAL);
        assertThat(resolution.hasData()).isTrue();
        assertThat(resolution.snapshot().price()).isEqualByComparingTo(new BigDecimal("70"));
        assertThat(resolution.snapshot().description()).isNull();
        assertThat(resolution.snapshot().imageUrls()).isEmpty();
    }
}
