package com.iozycore.listing.vinted;

import com.iozycore.listing.ListingHttpFetcher;
import com.iozycore.listing.ListingResolution;
import com.iozycore.listing.ListingSnapshot.ListingField;
import com.iozycore.listing.ListingPlatform;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le provider Vinted, <b>réseau remplacé par un faux</b> : la suite ne dépend
 * ni de Vinted en direct, ni d'une annonce qui existera encore demain. Les
 * pages fournies sont fabriquées et ne reproduisent que la forme constatée sur
 * une page publique.
 * <p>
 * Deux exigences sont vérifiées ici plus que les autres : un résultat
 * <b>partiel</b> reste utilisable, et une <b>donnée absente reste absente</b>.
 */
class VintedListingProviderTest {

    /** Faux récupérateur : rend la page (ou l'échec) qu'on lui a fixé, sans réseau. */
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

    // ------------------------------------------------------ Détection de source

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

        // Chaque provider apporte SA liste blanche : aucun n'hérite de celle
        // d'un autre, et il n'existe pas de liste globale.
        assertThat(fetcher.hotesRecus).contains("www.vinted.fr", "vinted.fr").doesNotContain("localhost");
        assertThat(fetcher.urlDemandee).isEqualTo("https://www.vinted.fr/items/42");
    }

    // ------------------------------------------------------------- Récupération

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
        // Les frais annoncés par l'annonce : sans eux, le coût réel partirait
        // de zéro et rendrait tout verdict trop favorable.
        assertThat(resolution.snapshot().shippingFee()).isEqualByComparingTo("4.99");
        assertThat(resolution.snapshot().buyerProtectionFee()).isEqualByComparingTo("1.20");
        // Le snapshot est daté : c'est un état à un instant T, pas un lien vivant.
        assertThat(resolution.snapshot().retrievedAt()).isNotNull();
        // L'URL canonique remplace celle qui a été collée.
        assertThat(resolution.snapshot().sourceUrl()).isEqualTo("https://www.vinted.fr/items/42-un-lot");
    }

    @Test
    void un_resultat_partiel_reste_utilisable_et_dit_ce_qui_manque() {
        // Titre et prix lus, photos et description illisibles - le cas courant
        // si Vinted change la forme de ses données embarquées.
        fetcher.reponse = page("""
                <meta property="og:title" content="Un lot | Vinted"/>
                <script>x:{\\"price\\":{\\"amount\\":\\"55.5\\",\\"currency_code\\":\\"EUR\\"}}</script>""");

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.PARTIAL);
        assertThat(resolution.hasData()).isTrue();
        assertThat(resolution.snapshot().retrievedFields())
                .containsExactlyInAnyOrder(ListingField.TITLE, ListingField.PRICE);
        // Rien n'est inventé pour combler les trous.
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

    // ------------------------------------------------------------------- Échecs

    @Test
    void une_annonce_supprimee_est_une_erreur_metier_distincte() {
        fetcher.reponse = new ListingHttpFetcher.Fetched(null, null, ListingHttpFetcher.Failure.NOT_FOUND);

        ListingResolution resolution = provider.resolve("https://www.vinted.fr/items/42");

        assertThat(resolution.status()).isEqualTo(ListingResolution.Status.LISTING_NOT_FOUND);
        assertThat(resolution.snapshot()).isNull();
        // L'URL reste connue : le parcours manuel continue avec le lien.
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
        // Répondre 200 avec une page inattendue ne vaut pas mieux qu'une panne :
        // il n'y a rien à pré-remplir, et l'utilisateur doit le savoir.
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
