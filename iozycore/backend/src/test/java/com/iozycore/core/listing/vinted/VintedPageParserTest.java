package com.iozycore.core.listing.vinted;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The parser is a pure function: these tests give it HTML and check
 * what it extracts, <b>never calling Vinted</b>. The suite therefore depends
 * neither on the network, nor on a listing that will still exist tomorrow.
 * <p>
 * The HTML used here is <b>fabricated</b> and only reproduces the SHAPE
 * seen on a public page (OpenGraph tags, shape of the embedded
 * data). No real listing content is copied into the repository.
 * <p>
 * What these tests protect above all: the absence of a datum must produce
 * an empty field, never a replacement value.
 */
class VintedPageParserTest {

    /** A full page: OpenGraph + price and photos in the embedded data. */
    private static final String PAGE_COMPLETE = """
            <html><head>
            <meta property="og:title" content="Lot integrale tomes 1-14 | Vinted"/>
            <meta property="og:description" content="Serie complete, tres bon etat"/>
            <meta property="og:url" content="https://www.vinted.fr/items/424242-lot-integrale"/>
            <meta property="og:image" content="https://images1.vinted.net/t/aaa/f800/1.webp"/>
            </head><body>
            <script>self.__next_f.push([1,"x:{\\"item\\":{\\"id\\":424242,\\"title\\":\\"Lot integrale\\"}"])</script>
            <script>self.__next_f.push([1,"y:{\\"price\\":{\\"amount\\":\\"70.0\\",\\"currency_code\\":\\"EUR\\"}}"])</script>
            <script>self.__next_f.push([1,"z:{\\"shippingDetails\\":{\\"isPickupOnly\\":false,\\"isFreeShipping\\":false,\\"price\\":{\\"amount\\":\\"4.99\\",\\"currencyCode\\":\\"EUR\\"}}}"])</script>
            <script>self.__next_f.push([1,"p:{\\"buyerProtection\\":{\\"originalPrice\\":{\\"amount\\":\\"2.40\\",\\"currencyCode\\":\\"EUR\\"},\\"finalPrice\\":{\\"amount\\":\\"1.20\\",\\"currencyCode\\":\\"EUR\\"}}}"])</script>
            <script>self.__next_f.push([1,"w:{\\"photos\\":[{\\"id\\":1,\\"is_main\\":true,\\"url\\":\\"https://images1.vinted.net/t/aaa/f800/1.webp\\",\\"thumbnails\\":[{\\"url\\":\\"https://images1.vinted.net/t/aaa/70x100/1.webp\\"}]},{\\"id\\":2,\\"is_main\\":false,\\"url\\":\\"https://images1.vinted.net/t/aaa/f800/2.webp\\",\\"thumbnails\\":[]}]}"])</script>
            </body></html>""";

    @Test
    void lit_le_titre_la_description_le_prix_et_les_photos_d_une_page_complete() {
        VintedPageParser.ParsedPage page = VintedPageParser.parse(PAGE_COMPLETE, "https://www.vinted.fr/items/424242", 12);

        assertThat(page.title()).isEqualTo("Lot integrale tomes 1-14");
        assertThat(page.description()).isEqualTo("Serie complete, tres bon etat");
        assertThat(page.price()).isEqualByComparingTo(new BigDecimal("70.0"));
        assertThat(page.currency()).isEqualTo("EUR");
        assertThat(page.canonicalUrl()).isEqualTo("https://www.vinted.fr/items/424242-lot-integrale");
        assertThat(page.externalId()).isEqualTo("424242");
        assertThat(page.imageUrls()).containsExactly(
                "https://images1.vinted.net/t/aaa/f800/1.webp",
                "https://images1.vinted.net/t/aaa/f800/2.webp");
    }

    @Test
    void ne_confond_pas_le_prix_de_l_article_avec_les_frais_de_port() {
        VintedPageParser.ParsedPage page = VintedPageParser.parse(PAGE_COMPLETE, "https://www.vinted.fr/items/424242", 12);

        // The shipping costs (4.99) appear BEFORE in the page on some
        // listings: taking "the first price found" would give a wrong cost.
        // The discriminator is the currency key, currency_code vs currencyCode.
        assertThat(page.price()).isEqualByComparingTo(new BigDecimal("70.0"));
    }

    @Test
    void ne_retient_que_les_photos_de_l_article_pas_leurs_vignettes() {
        VintedPageParser.ParsedPage page = VintedPageParser.parse(PAGE_COMPLETE, "https://www.vinted.fr/items/424242", 12);

        assertThat(page.imageUrls()).noneMatch(url -> url.contains("70x100"));
    }

    @Test
    void plafonne_le_nombre_de_photos() {
        VintedPageParser.ParsedPage page = VintedPageParser.parse(PAGE_COMPLETE, "https://www.vinted.fr/items/424242", 1);

        assertThat(page.imageUrls()).hasSize(1);
    }

    @Test
    void lit_les_frais_de_port_et_la_protection_acheteur() {
        VintedPageParser.ParsedPage page = VintedPageParser.parse(PAGE_COMPLETE, "https://www.vinted.fr/items/424242", 12);

        assertThat(page.shippingFee()).isEqualByComparingTo("4.99");
        // finalPrice (1.20), never originalPrice (2.40): a discount may
        // apply, and the amount actually charged is what counts.
        assertThat(page.buyerProtectionFee()).isEqualByComparingTo("1.20");
    }

    @Test
    void une_livraison_gratuite_vaut_zero_pas_une_absence() {
        String gratuit = """
                <meta property="og:title" content="Lot port offert | Vinted"/>
                <script>x:{\\"shippingDetails\\":{\\"isFreeShipping\\":true,\\"price\\":{\\"amount\\":\\"0.0\\",\\"currencyCode\\":\\"EUR\\"}}}</script>""";

        // A real zero: telling it apart from an unreadable cost avoids making
        // the user enter by hand an amount the listing already gives.
        assertThat(VintedPageParser.parse(gratuit, "https://www.vinted.fr/items/1", 12).shippingFee())
                .isEqualByComparingTo("0");
    }

    @Test
    void les_frais_ne_sont_pas_confondus_avec_le_prix_de_l_article() {
        VintedPageParser.ParsedPage page = VintedPageParser.parse(PAGE_COMPLETE, "https://www.vinted.fr/items/424242", 12);

        // Three distinct amounts in the same page - mixing them would give
        // a wrong real cost, so a wrong verdict.
        assertThat(page.price()).isEqualByComparingTo("70.0");
        assertThat(page.shippingFee()).isEqualByComparingTo("4.99");
        assertThat(page.buyerProtectionFee()).isEqualByComparingTo("1.20");
    }

    @Test
    void des_frais_illisibles_restent_absents() {
        String sansFrais = "<meta property=\"og:title\" content=\"Un lot | Vinted\"/>";

        VintedPageParser.ParsedPage page = VintedPageParser.parse(sansFrais, "https://www.vinted.fr/items/1", 12);

        // Neither zero, nor default value: the user will enter it.
        assertThat(page.shippingFee()).isNull();
        assertThat(page.buyerProtectionFee()).isNull();
    }

    @Test
    void un_prix_absent_reste_absent_et_n_est_jamais_remplace() {
        String sansPrix = """
                <html><head>
                <meta property="og:title" content="Lot sans prix lisible | Vinted"/>
                <meta property="og:url" content="https://www.vinted.fr/items/99"/>
                </head><body></body></html>""";

        VintedPageParser.ParsedPage page = VintedPageParser.parse(sansPrix, "https://www.vinted.fr/items/99", 12);

        assertThat(page.title()).isEqualTo("Lot sans prix lisible");
        // The heart of the module: no demo value, no zero by
        // default, no estimate. The field stays empty and the user enters it.
        assertThat(page.price()).isNull();
        assertThat(page.currency()).isNull();
        assertThat(page.imageUrls()).isEmpty();
        assertThat(page.description()).isNull();
    }

    @Test
    void une_page_sans_aucune_donnee_exploitable_ne_rend_rien() {
        VintedPageParser.ParsedPage page = VintedPageParser.parse(
                "<html><head></head><body>Page inattendue</body></html>", "https://www.vinted.fr/items/7", 12);

        assertThat(page.title()).isNull();
        assertThat(page.price()).isNull();
        assertThat(page.imageUrls()).isEmpty();
        // The identifier can still be found in the requested URL.
        assertThat(page.externalId()).isEqualTo("7");
    }

    @Test
    void retire_le_suffixe_de_partage_du_titre() {
        String page = "<meta property=\"og:title\" content=\"Un titre | Vinted\"/>";

        assertThat(VintedPageParser.parse(page, "https://www.vinted.fr/items/1", 12).title()).isEqualTo("Un titre");
    }

    @Test
    void lit_les_balises_meta_quel_que_soit_l_ordre_des_attributs() {
        String page = "<meta content=\"Titre en attribut inverse\" property=\"og:title\"/>";

        assertThat(VintedPageParser.parse(page, "https://www.vinted.fr/items/1", 12).title())
                .isEqualTo("Titre en attribut inverse");
    }
}
