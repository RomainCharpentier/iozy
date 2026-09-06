package com.iozycore.manga.metadata.bnf;

import com.iozycore.manga.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BnfVolumeSearchProviderTest {

    @Test
    void extracts_the_volume_number_edition_and_publisher_from_a_real_marc_record() throws Exception {
        // Fixture basée sur la vraie réponse SRU de la BnF (vérifiée
        // manuellement à la demande de l'utilisateur, voir historique de la
        // conversation) pour "Dragon Ball Full Color - L'enfance de Goku"
        // (Glénat, à partir de mai 2024) - introuvable sur Google Books
        // quelle que soit la formulation essayée, mais bien référencé ici
        // grâce au dépôt légal.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Dragon Ball</mxc:subfield>
                  <mxc:subfield code="b">Texte imprimé</mxc:subfield>
                  <mxc:subfield code="e">full color</mxc:subfield>
                  <mxc:subfield code="e">l'enfance de Goku</mxc:subfield>
                  <mxc:subfield code="h">7</mxc:subfield>
                  <mxc:subfield code="f">Akira Toriyama</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="214" ind1=" " ind2="0">
                  <mxc:subfield code="a">Grenoble</mxc:subfield>
                  <mxc:subfield code="c">Glénat</mxc:subfield>
                  <mxc:subfield code="d">DL 2024-</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Dragon Ball");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(7);
        assertThat(result.get(0).edition()).isEqualTo("Full Color - L'enfance De Goku");
        assertThat(result.get(0).imageUrl()).isNull(); // jamais de jaquette côté BnF
    }

    @Test
    void skips_the_series_level_record_that_has_no_volume_number() throws Exception {
        // Cas réel observé (voir historique) : la notice "collection" (sans
        // 200$h) apparaît dans les mêmes résultats de recherche que les
        // notices de tomes précis - rien à proposer, contrairement aux
        // tomes numérotés qui suivent.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Dragon ball</mxc:subfield>
                  <mxc:subfield code="b">Texte imprimé</mxc:subfield>
                  <mxc:subfield code="e">full color</mxc:subfield>
                  <mxc:subfield code="e">l'enfance de Goku</mxc:subfield>
                  <mxc:subfield code="f">Akira Toriyama</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Dragon Ball");

        assertThat(result).isEmpty();
    }

    @Test
    void falls_back_to_the_publisher_when_no_collection_name_remains() throws Exception {
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Death Note</mxc:subfield>
                  <mxc:subfield code="h">3</mxc:subfield>
                  <mxc:subfield code="f">Tsugumi Ohba</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="214" ind1=" " ind2="0">
                  <mxc:subfield code="c">Kana</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Death Note");

        assertThat(result.get(0).edition()).isEqualTo("Kana");
    }

    @Test
    void normalizes_the_edition_or_accented_word_regardless_of_case_or_accent() throws Exception {
        // Cas réel observé sur "Fairy Tail" (voir historique) : la BnF
        // indexe le même éditeur ("Pika") avec ou sans le mot
        // "édition"/"edition" accentué ou non selon la notice, formant
        // sinon plusieurs onglets d'édition distincts pour un seul éditeur
        // réel.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String withoutAccent = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Fairy Tail</mxc:subfield>
                  <mxc:subfield code="h">61</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="214" ind1=" " ind2="0">
                  <mxc:subfield code="c">Pika Edition</mxc:subfield>
                </mxc:datafield>
                """);
        String withAccent = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Fairy Tail</mxc:subfield>
                  <mxc:subfield code="h">62</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="214" ind1=" " ind2="0">
                  <mxc:subfield code="c">Pika édition</mxc:subfield>
                </mxc:datafield>
                """);

        assertThat(provider.parse(withoutAccent, "Fairy Tail").get(0).edition()).isEqualTo("Pika Édition");
        assertThat(provider.parse(withAccent, "Fairy Tail").get(0).edition()).isEqualTo("Pika Édition");
    }

    @Test
    void normalizes_the_plural_form_of_edition_too() throws Exception {
        // Cas réel trouvé en continuant les tests sur "Blue Period" (voir
        // historique) : "Pika éditions" (pluriel) formait encore un onglet
        // distinct de "Pika Édition" malgré normalizes_the_edition_or_accented_word...
        // ci-dessus - le \b final de ce premier assouplissement ne validait
        // jamais de frontière de mot entre "n" et le "s" du pluriel.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Blue Period</mxc:subfield>
                  <mxc:subfield code="h">3</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="214" ind1=" " ind2="0">
                  <mxc:subfield code="c">Pika éditions</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Blue Period");

        assertThat(result.get(0).edition()).isEqualTo("Pika Édition");
    }

    @Test
    void matches_the_series_title_even_when_a_word_boundary_falls_differently() throws Exception {
        // Cas réel trouvé en continuant les tests sur "Cardcaptor Sakura"
        // (voir historique) : le titre MyAnimeList cherché tient "Cardcaptor"
        // en un seul mot, alors que la BnF indexe le $a réel avec un espace
        // ("Card captor Sakura") - une simple comparaison insensible à la
        // casse ne suffisait pas, sans jamais avoir besoin d'un préfixe flou
        // façon Google Books (le $a de la BnF reste le titre complet, pas un
        // titre plus long à préfixer).
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Card captor Sakura</mxc:subfield>
                  <mxc:subfield code="h">4</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Cardcaptor Sakura");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(4);
    }

    @Test
    void excludes_a_known_spin_off_series_flagged_via_related_series_fragments() throws Exception {
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Dragon Ball</mxc:subfield>
                  <mxc:subfield code="e">super</mxc:subfield>
                  <mxc:subfield code="h">3</mxc:subfield>
                  <mxc:subfield code="f">Akira Toriyama</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="214" ind1=" " ind2="0">
                  <mxc:subfield code="c">Glénat</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Dragon Ball", List.of("Dragon Ball Super"));

        assertThat(result).isEmpty();
    }

    @Test
    void ignores_an_unrelated_title_that_does_not_match_the_series_searched() throws Exception {
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Dragonboule</mxc:subfield>
                  <mxc:subfield code="h">2</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Dragon Ball");

        assertThat(result).isEmpty();
    }

    @Test
    void returns_empty_when_there_are_no_records() throws Exception {
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();

        List<VolumeCandidate> result = provider.parse(realResponse(""), "Dragon Ball");

        assertThat(result).isEmpty();
    }

    /** Enveloppe SRU minimale (espaces de nommage réels de la BnF) autour
     * d'un seul enregistrement MARC dont le contenu est fourni par le test -
     * évite de répéter cette enveloppe dans chaque fixture. */
    // ------------------------------------ Les romans jeunesse (lot 144)

    private static final String ROMAN_SANS_COLLECTION = """
            <mxc:datafield tag="200" ind1="1" ind2=" ">
              <mxc:subfield code="a">Le secret de Nami</mxc:subfield>
              <mxc:subfield code="b">Texte imprimé</mxc:subfield>
            </mxc:datafield>
            <mxc:datafield tag="210" ind1=" " ind2=" ">
              <mxc:subfield code="a">Paris</mxc:subfield>
              <mxc:subfield code="c">Hachette jeunesse</mxc:subfield>
            </mxc:datafield>
            <mxc:datafield tag="225" ind1="2" ind2=" ">
              <mxc:subfield code="a">One piece</mxc:subfield>
              <mxc:subfield code="v">3</mxc:subfield>
            </mxc:datafield>
            """;

    @Test
    void ecarte_un_roman_jeunesse_que_la_bnf_rattache_a_la_serie() throws Exception {
        // Mesure du 2026-09-06 : « Le secret de Nami », Bibliothèque verte,
        // 225$a « One piece » $v 3 - un roman Hachette jeunesse tire de
        // l'anime, que la BnF rattache a la serie par sa collection, et que
        // mangacollec n'a jamais compte parmi les tomes. Onze de ces romans
        // faisaient une edition « Hachette jeunesse » de One Piece.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse(ROMAN_SANS_COLLECTION + """
                <mxc:datafield tag="410" ind1=" " ind2="|">
                  <mxc:subfield code="t">Bibliothèque verte</mxc:subfield>
                </mxc:datafield>
                """);

        assertThat(provider.parse(xml, "One Piece")).isEmpty();
    }

    @Test
    void garde_un_tome_rattache_par_sa_collection_quand_ce_n_est_pas_une_collection_de_romans() throws Exception {
        // Le meme rattachement par 225 sans marque de romans jeunesse reste
        // un tome : c'est la voie des premiers Dragon Ball et de Boruto.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();

        List<VolumeCandidate> result = provider.parse(realResponse(ROMAN_SANS_COLLECTION), "One Piece");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(3);
        assertThat(result.get(0).edition()).isEqualTo("Hachette jeunesse");
    }

    // ------------------------------------ Les produits derives (lot 144)

    @Test
    void ecarte_un_art_book_catalogue_comme_un_tome_de_la_serie() throws Exception {
        // Mesure du 2026-09-06 : « Naruto, grand livre d'Uzumaki » T1 et T2
        // (Kana) prenaient la place des tomes 1 et 2, renvoyes dans une
        // « Kana (2002) » a part par la separation par ISBN.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Naruto</mxc:subfield>
                  <mxc:subfield code="b">Texte imprimé</mxc:subfield>
                  <mxc:subfield code="e">grand livre d'Uzumaki</mxc:subfield>
                  <mxc:subfield code="h">T1</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="210" ind1=" " ind2=" ">
                  <mxc:subfield code="c">Kana</mxc:subfield>
                </mxc:datafield>
                """);

        assertThat(provider.parse(xml, "Naruto")).isEmpty();
    }

    @Test
    void garde_un_tome_dont_le_sous_titre_n_est_ni_une_edition_ni_un_produit_derive() throws Exception {
        // « Grande chance », T21 de Jujutsu Kaisen : un sous-titre de tome
        // (lot 131), toujours un tome de l'edition de son editeur.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = realResponse("""
                <mxc:datafield tag="200" ind1="1" ind2=" ">
                  <mxc:subfield code="a">Jujutsu Kaisen</mxc:subfield>
                  <mxc:subfield code="b">Texte imprimé</mxc:subfield>
                  <mxc:subfield code="e">Grande chance</mxc:subfield>
                  <mxc:subfield code="h">21</mxc:subfield>
                </mxc:datafield>
                <mxc:datafield tag="214" ind1=" " ind2="0">
                  <mxc:subfield code="c">Ki-oon</mxc:subfield>
                </mxc:datafield>
                """);

        List<VolumeCandidate> result = provider.parse(xml, "Jujutsu Kaisen");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(21);
        assertThat(result.get(0).edition()).isEqualTo("Ki-oon");
    }

    @Test
    void ecarte_une_autre_oeuvre_cataloguee_sous_le_nom_de_la_serie_quand_ses_numeros_doublent_ceux_des_tomes() throws Exception {
        // Mesure du 2026-09-06 : « Naruto » + $e « Konoha shinden / the steam
        // ninja scrolls » T1 et T2 (un roman, chez Kana comme les 72 tomes) et
        // « les liens, répliques célèbres » T1 et T2 prenaient la place des
        // tomes 1 et 2 ; la separation par ISBN renvoyait alors les vrais
        // dans une « Kana (2002) » a part. Un $e partage par plusieurs tomes
        // dont la serie a deja les numeros est une autre oeuvre.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = plusieursNotices(
                tome("Naruto", null, "1"), tome("Naruto", null, "2"), tome("Naruto", null, "3"),
                tome("Naruto", "Konoha shinden / the steam ninja scrolls", "Tome 1"),
                tome("Naruto", "Konoha shinden / the steam ninja scrolls", "Tome 2"),
                // Un sous-titre porte par UN seul tome reste un tome (lot 131).
                tome("Naruto", "Grande chance", "4"));

        List<VolumeCandidate> result = provider.parse(xml, "Naruto");

        assertThat(result).extracting(VolumeCandidate::volumeNumber).containsExactly(1, 2, 3, 4);
        assertThat(result).extracting(VolumeCandidate::title).noneMatch(titre -> titre.contains("Konoha"));
    }

    private static String tome(String serie, String sousTitre, String numero) {
        return """
                <srw:record>
                  <srw:recordData>
                    <mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2" format="UNIMARC" type="Bibliographic">
                      <mxc:datafield tag="200" ind1="1" ind2=" ">
                        <mxc:subfield code="a">%s</mxc:subfield>
                        <mxc:subfield code="b">Texte imprimé</mxc:subfield>
                        %s
                        <mxc:subfield code="h">%s</mxc:subfield>
                      </mxc:datafield>
                      <mxc:datafield tag="214" ind1=" " ind2="0">
                        <mxc:subfield code="c">Kana</mxc:subfield>
                      </mxc:datafield>
                    </mxc:record>
                  </srw:recordData>
                </srw:record>
                """.formatted(serie, sousTitre == null ? "" : "<mxc:subfield code=\"e\">" + sousTitre + "</mxc:subfield>", numero);
    }

    private static String plusieursNotices(String... notices) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
                  <srw:numberOfRecords>%d</srw:numberOfRecords>
                  <srw:records>%s</srw:records>
                </srw:searchRetrieveResponse>
                """.formatted(notices.length, String.join("", notices));
    }

    private static String realResponse(String datafields) {
        if (datafields.isBlank()) {
            return """
                    <?xml version="1.0" encoding="UTF-8"?>
                    <srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
                      <srw:numberOfRecords>0</srw:numberOfRecords>
                      <srw:records></srw:records>
                    </srw:searchRetrieveResponse>
                    """;
        }
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/">
                  <srw:numberOfRecords>1</srw:numberOfRecords>
                  <srw:records>
                    <srw:record>
                      <srw:recordData>
                        <mxc:record xmlns:mxc="info:lc/xmlns/marcxchange-v2" format="UNIMARC" type="Bibliographic">
                          %s
                        </mxc:record>
                      </srw:recordData>
                    </srw:record>
                  </srw:records>
                </srw:searchRetrieveResponse>
                """.formatted(datafields);
    }
}
