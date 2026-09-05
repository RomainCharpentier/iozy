package com.iozycore.core.listing.leboncoin;

import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingPlatform;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reconnaître sans lire.
 *
 * <p>Ces tests protègent deux choses de nature différente : le message juste
 * (une source qui refuse les robots n'est pas une source « pas encore prise en
 * charge »), et l'impossibilité <b>structurelle</b> d'émettre une requête vers
 * Leboncoin.
 */
class LeboncoinListingProviderTest {

    private final LeboncoinListingProvider provider = new LeboncoinListingProvider();

    // ====================================================== Reconnaissance

    @Test
    void a_leboncoin_listing_is_recognised() {
        assertThat(provider.supports("https://www.leboncoin.fr/ad/livres/3252049142")).isTrue();
        assertThat(provider.supports("https://leboncoin.fr/ad/livres/123")).isTrue();
        assertThat(provider.supports("https://m.leboncoin.fr/ad/livres/123")).isTrue();
    }

    @Test
    void a_host_that_merely_contains_the_name_is_not_leboncoin() {
        // leboncoin.fr.attaquant.example ne doit jamais passer pour Leboncoin :
        // la comparaison porte sur l'hôte exact, jamais sur « l'URL contient ».
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

    // ====================================================== Le message juste

    @Test
    void the_status_says_the_source_refuses_automation_not_that_support_is_missing() {
        ListingResolution resolution = provider.resolve("https://www.leboncoin.fr/ad/livres/3252049142");

        // UNSUPPORTED_SOURCE se lirait « pas encore pris en charge », et ferait
        // attendre une fonctionnalité qui ne viendra pas ainsi. UNAVAILABLE se
        // lirait « réessaie », ce qui ne marchera jamais.
        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.SOURCE_BLOCKS_AUTOMATION);
        assertThat(resolution.status()).isNotEqualTo(ListingResolution.Status.UNSUPPORTED_SOURCE);
        assertThat(resolution.status()).isNotEqualTo(ListingResolution.Status.UNAVAILABLE);
    }

    @Test
    void the_platform_is_named_and_the_link_is_kept() {
        String url = "https://www.leboncoin.fr/ad/livres/3252049142";

        ListingResolution resolution = provider.resolve(url);

        // L'utilisateur doit retrouver son annonce : le lien survit à l'échec.
        assertThat(resolution.source()).isEqualTo(ListingPlatform.LEBONCOIN);
        assertThat(resolution.url()).isEqualTo(url);
        assertThat(resolution.snapshot()).isNull();
    }

    // ====================================================== Aucune requête possible

    @Test
    void this_provider_authorises_the_server_to_reach_nothing() {
        // Le fond du sujet : il reconnaît la source, il ne la joint pas. Même un
        // bug d'appel ne pourrait pas déclencher de requête vers Leboncoin.
        assertThat(provider.allowedHosts()).isEmpty();
        assertThat(provider.allowedImageHosts()).isEmpty();
    }

    @Test
    void resolving_never_touches_the_network() {
        // Aucun fetcher n'est injecté : la classe n'a aucun moyen d'émettre une
        // requête, ce qui vaut mieux qu'une promesse de ne pas le faire.
        long debut = System.nanoTime();
        provider.resolve("https://www.leboncoin.fr/ad/livres/3252049142");
        long dureeMs = (System.nanoTime() - debut) / 1_000_000;

        assertThat(dureeMs).as("réponse immédiate, donc sans aller-retour réseau").isLessThan(50);
    }
}
