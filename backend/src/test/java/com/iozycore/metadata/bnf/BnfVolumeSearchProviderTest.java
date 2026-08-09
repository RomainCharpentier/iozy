package com.iozycore.metadata.bnf;

import com.iozycore.metadata.VolumeCandidate;
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
