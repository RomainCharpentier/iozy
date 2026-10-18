package com.iozycore.core.listing.vinted;

import com.iozycore.core.listing.ListingHttpFetcher;
import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingSnapshot.ListingField;
import com.iozycore.core.listing.ListingPlatform;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Vinted provider, <b>network replaced by a fake</b>: the suite depends
 * neither on live Vinted, nor on a listing that will still exist tomorrow. The
 * pages provided are fabricated and only reproduce the shape seen on
 * a public page.
 * <p>
 * Two requirements are checked here more than the others: a <b>partial</b>
 * result stays usable, and an <b>absent datum stays absent</b>.
 */
class VintedListingProviderTest {

    /** Fake fetcher: returns the page (or the failure) it was given, without network. */
    private static class FetcherFactice extends ListingHttpFetcher {
        private Fetched reponse;
        private String urlDemandee;
        private Set<String> hotesRecus;

        @Override
        public Fetched fetchHtml(String rawUrl, Set<String> allowedHosts) {
            this.urlDemandee = rawUrl;
            this.hotesRecus = allowedHosts;
            return reponse;
        }
    }

    private final FetcherFactice fetcher = new FetcherFactice();
    private final VintedListingProvider provider = new VintedListingProvider(fetcher);

    private static ListingHttpFetcher.Fetched page(String html) {
        return new ListingHttpFetcher.Fetched(html, URI.create("https://www.vinted.fr/items/42"), null);
    }

    // ------------------------------------------------------ Source detection

    @Test
    void reconnait_les_domaines_vinted_par_leur_hote() {
        assertThat(provider.supports("https://www.vinted.fr/items/42")).isTrue();
        assertThat(provider.supports("https://vinted.fr/items/42")).isTrue();
        assertThat(provider.supports("https://www.vinted.be/items/42")).isTrue();
        assertThat(provider.supports("https://www.vinted.co.uk/items/42")).isTrue();
    }

    @Test
    void ne_reconnait_pas_une_url_qui_mentionne_vinted_sans_en_etre() {
        assertThat(provider.supports("https://phishing.invalid/www.vinted.fr/items/42")).isFalse();
        assertThat(provider.supports("https://vinted.fr.attaquant.invalid/items/42")).isFalse();
        assertThat(provider.supports("https://www.leboncoin.fr/ad/1")).isFalse();
        assertThat(provider.supports("pas une url")).isFalse();
    }

    @Test
    void ne_transmet_au_recuperateur_que_ses_propres_hotes_autorises() {
        fetcher.reponse = page("<meta property=\"og:title\" content=\"Un lot | Vinted\"/>");

        provider.resolve("https://www.vinted.fr/items/42");

        // Each provider brings ITS OWN whitelist: none inherits that
        // of another, and there is no global list.
        assertThat(fetcher.hotesRecus).contains("www.vinted.fr", "vinted.fr").doesNotContain("localhost");
        assertThat(fetcher.urlDemandee).isEqualTo("https://www.vinted.fr/items/42");
    }

    // ------------------------------------------------------------- Fetching

    @Test
    void rend_un_succes_quand_tout_a_pu_etre_lu() {
        fetcher.reponse = page("""
                <meta property="og:title" content="Un lot | Vinted"/>
                <meta property="og:description" content="Description du lot"/>
                <meta property="og:url" content="https://www.vinted.fr/items/42-un-lot"/>
                <script>x:{\\"price\\":{\\"amount\\":\\"70.0\\",\\"currency_code\\":\\"EUR\\"}}</script>
                <script>s:{\\"shippingDetails\\":{\\"isFreeShipping\\":false,\\"price\\":{\\"amount\\":\\"4.99\\",\\"currencyCode\\":\\"EUR\\"}}}</script>
                <script>b:{\\"buyerProtection\\":{\\"finalPrice\\":{\\"amount\\":\\"1.20\\",\\"currencyCode\\":\\"EUR\\"}}}</script>
                <script>y:{\\"photos\\":[{\\"id\\":1,\\"is_main\\":true,\\"url\\":\\"https://images1.vinted.net/a/f800/1.webp\\"}]}</script>""");

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.SUCCESS);
        assertThat(resolution.snapshot().source()).isEqualTo(ListingPlatform.VINTED);
        assertThat(resolution.snapshot().title()).isEqualTo("Un lot");
        assertThat(resolution.snapshot().price()).isEqualByComparingTo(new BigDecimal("70.0"));
        assertThat(resolution.snapshot().imageUrls()).hasSize(1);
        assertThat(resolution.snapshot().retrievedFields())
                .containsExactlyInAnyOrder(ListingField.TITLE, ListingField.DESCRIPTION,
                        ListingField.PRICE, ListingField.SHIPPING_FEE, ListingField.BUYER_PROTECTION_FEE,
                        ListingField.IMAGES);
        // The costs announced by the listing: without them, the real cost would start
        // from zero and make every verdict too favourable.
        assertThat(resolution.snapshot().shippingFee()).isEqualByComparingTo("4.99");
        assertThat(resolution.snapshot().buyerProtectionFee()).isEqualByComparingTo("1.20");
        // The snapshot is dated: it is a state at a given time, not a live link.
        assertThat(resolution.snapshot().retrievedAt()).isNotNull();
        // The canonical URL replaces the one that was pasted.
        assertThat(resolution.snapshot().sourceUrl()).isEqualTo("https://www.vinted.fr/items/42-un-lot");
    }

    @Test
    void un_resultat_partiel_reste_utilisable_et_dit_ce_qui_manque() {
        // Title and price read, photos and description unreadable - the common case
        // if Vinted changes the shape of its embedded data.
        fetcher.reponse = page("""
                <meta property="og:title" content="Un lot | Vinted"/>
                <script>x:{\\"price\\":{\\"amount\\":\\"55.5\\",\\"currency_code\\":\\"EUR\\"}}</script>""");

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.PARTIAL);
        assertThat(resolution.hasData()).isTrue();
        assertThat(resolution.snapshot().retrievedFields())
                .containsExactlyInAnyOrder(ListingField.TITLE, ListingField.PRICE);
        // Nothing is invented to fill the gaps.
        assertThat(resolution.snapshot().description()).isNull();
        assertThat(resolution.snapshot().imageUrls()).isEmpty();
    }

    @Test
    void un_prix_illisible_ne_devient_jamais_une_valeur_par_defaut() {
        fetcher.reponse = page("<meta property=\"og:title\" content=\"Un lot sans prix | Vinted\"/>");

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.snapshot().price()).isNull();
        assertThat(resolution.snapshot().currency()).isNull();
        assertThat(resolution.snapshot().retrievedFields()).doesNotContain(ListingField.PRICE);
    }

    // ------------------------------------------------------------------- Failures

    @Test
    void une_annonce_supprimee_est_une_erreur_metier_distincte() {
        fetcher.reponse = new ListingHttpFetcher.Fetched(null, null, ListingHttpFetcher.Failure.NOT_FOUND);

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.LISTING_NOT_FOUND);
        assertThat(resolution.snapshot()).isNull();
        // The URL stays known: the manual flow continues with the link.
        assertThat(resolution.url()).isEqualTo("https://www.vinted.fr/items/42");
    }

    @Test
    void un_blocage_ou_une_panne_se_distingue_d_une_annonce_supprimee() {
        fetcher.reponse = new ListingHttpFetcher.Fetched(null, null, ListingHttpFetcher.Failure.UNAVAILABLE);

        assertThat(provider.resolve("https://www.vinted.fr/items/42").status())
                .isEqualTo(ListingResolution.Status.UNAVAILABLE);
    }

    @Test
    void une_url_refusee_par_le_garde_fou_ne_produit_pas_de_snapshot() {
        fetcher.reponse = new ListingHttpFetcher.Fetched(null, null, ListingHttpFetcher.Failure.URL_REJECTED);

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.INVALID_URL);
        assertThat(resolution.snapshot()).isNull();
    }

    @Test
    void une_page_qui_repond_mais_ne_livre_rien_est_traitee_comme_indisponible() {
        // Answering 200 with an unexpected page is no better than an outage:
        // there is nothing to pre-fill, and the user must know.
        fetcher.reponse = page("<html><body>Rien d'exploitable</body></html>");

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.UNAVAILABLE);
        assertThat(resolution.snapshot()).isNull();
    }

    @Test
    void plafonne_le_nombre_de_photos_rapportees() {
        StringBuilder photos = new StringBuilder("<script>y:{\\\"photos\\\":[");
        for (int i = 0; i < VintedListingProvider.MAX_IMAGES + 10; i++) {
            if (i > 0) photos.append(",");
            photos.append("{\\\"id\\\":").append(i)
                    .append(",\\\"is_main\\\":").append(i == 0)
                    .append(",\\\"url\\\":\\\"https://images1.vinted.net/a/f800/").append(i).append(".webp\\\"}");
        }
        photos.append("]}</script>");
        fetcher.reponse = page("<meta property=\"og:title\" content=\"Beaucoup de photos | Vinted\"/>" + photos);

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.snapshot().imageUrls()).hasSize(VintedListingProvider.MAX_IMAGES);
    }
}
