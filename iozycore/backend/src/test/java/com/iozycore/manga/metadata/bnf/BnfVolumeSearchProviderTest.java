package com.iozycore.manga.metadata.bnf;

import com.iozycore.manga.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BnfVolumeSearchProviderTest {

    @Test
    void tries_the_author_as_given_then_without_long_vowels_then_the_family_name_alone() {
        assertThat(BnfVolumeSearchProvider.queriesFor("Berserk", "Kentarou Miura")).containsExactly(
                "bib.title all \"Berserk\" and bib.author all \"Kentarou Miura\"",
                "bib.title all \"Berserk\" and bib.author all \"Kentaro Miura\"",
                "bib.title all \"Berserk\" and bib.author all \"Miura\"");
        assertThat(BnfVolumeSearchProvider.queriesFor("Spy x Family", "Tatsuya Endou")).containsExactly(
                "bib.title all \"Spy x Family\" and bib.author all \"Tatsuya Endou\"",
                "bib.title all \"Spy x Family\" and bib.author all \"Tatsuya Endo\"",
                "bib.title all \"Spy x Family\" and bib.author all \"Endo\"");
    }

    @Test
    void never_repeats_a_query_and_never_falls_back_to_the_title_alone() {
        // No long vowel: the simplified name is the same, so only the family name is added.
        assertThat(BnfVolumeSearchProvider.queriesFor("Monster", "Naoki Urasawa")).containsExactly(
                "bib.title all \"Monster\" and bib.author all \"Naoki Urasawa\"",
                "bib.title all \"Monster\" and bib.author all \"Urasawa\"");
        // A single word: nothing to fall back to.
        assertThat(BnfVolumeSearchProvider.queriesFor("Monster", "Urasawa")).containsExactly(
                "bib.title all \"Monster\" and bib.author all \"Urasawa\"");
        // No author: the title alone, once, as before.
        assertThat(BnfVolumeSearchProvider.queriesFor("Monster", null)).containsExactly("bib.title all \"Monster\"");
        assertThat(BnfVolumeSearchProvider.queriesFor("Monster", " ")).containsExactly("bib.title all \"Monster\"");
    }

    @Test
    void extracts_the_volume_number_edition_and_publisher_from_a_real_marc_record() throws Exception {
        // Fixture based on the real SRU response of the BnF (checked
        // manually at the user's request, see the history of the
        // conversation) for "Dragon Ball Full Color - L'enfance de Goku"
        // (Glénat, from May 2024) - not found on Google Books
        // whatever the wording tried, but well referenced here
        // thanks to legal deposit.
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
        assertThat(result.get(0).imageUrl()).isNull(); // never a cover on the BnF side
    }

    @Test
    void skips_the_series_level_record_that_has_no_volume_number() throws Exception {
        // Real case observed (see history): the "collection" record (without
        // 200$h) appears in the same search results as the
        // records of specific volumes - nothing to propose, unlike the
        // numbered volumes that follow.
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
        // Real case observed on "Fairy Tail" (see history): the BnF
        // indexes the same publisher ("Pika") with or without the word
        // "édition"/"edition" accented or not depending on the record, otherwise
        // forming several distinct edition tabs for a single real
        // publisher.
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
        // Real case found while continuing the tests on "Blue Period" (see
        // history): "Pika éditions" (plural) still formed a tab
        // distinct from "Pika Édition" despite normalizes_the_edition_or_accented_word...
        // above - the final \b of this first relaxation never validated
        // a word boundary between "n" and the "s" of the plural.
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
        // Real case found while continuing the tests on "Cardcaptor Sakura"
        // (see history): the searched MyAnimeList title holds "Cardcaptor"
        // as a single word, while the BnF indexes the real $a with a space
        // ("Card captor Sakura") - a simple case-insensitive comparison
        // was not enough, without ever needing a fuzzy prefix like
        // Google Books (the BnF $a stays the full title, not a
        // longer title to prefix).
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

    /** Minimal SRU envelope (real BnF namespaces) around
     * a single MARC record whose content is provided by the test -
     * avoids repeating this envelope in each fixture. */
    // ------------------------------------ The children's novels (batch 144)

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
        // Measured on 2026-09-06: "Le secret de Nami", Bibliothèque verte,
        // 225$a "One piece" $v 3 - a Hachette children's novel drawn from
        // the anime, which the BnF attaches to the series through its collection, and which
        // mangacollec never counted among the volumes. Eleven of these novels
        // made a "Hachette jeunesse" edition of One Piece.
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
        // The same attachment through 225 without a children's novel mark stays
        // a volume: this is the path of the first Dragon Ball and Boruto.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();

        List<VolumeCandidate> result = provider.parse(realResponse(ROMAN_SANS_COLLECTION), "One Piece");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(3);
        assertThat(result.get(0).edition()).isEqualTo("Hachette jeunesse");
    }

    // ------------------------------------ The derived products (batch 144)

    @Test
    void ecarte_un_art_book_catalogue_comme_un_tome_de_la_serie() throws Exception {
        // Measured on 2026-09-06: "Naruto, grand livre d'Uzumaki" T1 and T2
        // (Kana) took the place of volumes 1 and 2, sent into a
        // separate "Kana (2002)" by the split by ISBN.
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
        // "Grande chance", T21 of Jujutsu Kaisen: a volume subtitle
        // (batch 131), always a volume of the edition of its publisher.
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
        // Measured on 2026-09-06: "Naruto" + $e "Konoha shinden / the steam
        // ninja scrolls" T1 and T2 (a novel, at Kana like the 72 volumes) and
        // "les liens, répliques célèbres" T1 and T2 took the place of
        // volumes 1 and 2; the split by ISBN then sent the real ones
        // into a separate "Kana (2002)". A $e shared by several volumes
        // whose series already has the numbers is another work.
        BnfVolumeSearchProvider provider = new BnfVolumeSearchProvider();
        String xml = plusieursNotices(
                tome("Naruto", null, "1"), tome("Naruto", null, "2"), tome("Naruto", null, "3"),
                tome("Naruto", "Konoha shinden / the steam ninja scrolls", "Tome 1"),
                tome("Naruto", "Konoha shinden / the steam ninja scrolls", "Tome 2"),
                // A subtitle carried by ONE single volume stays a volume (batch 131).
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
