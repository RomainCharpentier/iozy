package com.iozycore.boardgame.bgg;

import com.iozycore.core.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BggMetadataProviderTest {

    private static final String SAMPLE_RESPONSE = """
            <?xml version="1.0" encoding="utf-8"?>
            <items total="1" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
              <item type="boardgame" id="13">
                <name type="primary" sortindex="1" value="Catan"/>
                <yearpublished value="1995" />
              </item>
            </items>
            """;

    @Test
    void parses_id_title_and_year_from_a_bgg_response() throws Exception {
        BggMetadataProvider provider = new BggMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse(SAMPLE_RESPONSE);

        assertThat(candidates).hasSize(1);
        MetadataCandidate candidate = candidates.get(0);
        assertThat(candidate.source()).isEqualTo("BGG");
        assertThat(candidate.externalId()).isEqualTo("13");
        assertThat(candidate.title()).isEqualTo("Catan");
        assertThat(candidate.attributes()).containsEntry("yearPublished", "1995");
    }

    @Test
    void returns_an_empty_list_when_there_are_no_items() throws Exception {
        BggMetadataProvider provider = new BggMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse(
                "<items total=\"0\" termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(candidates).isEmpty();
    }

    private static MetadataCandidate jeu(String titre) {
        return new MetadataCandidate("BGG", titre, titre, null, java.util.Map.of());
    }

    /**
     * Constaté en cherchant « Carcassonne » dans l'application : BGG rendait 144
     * lignes dans SON ordre - alphabétique - ouvertes par treize extensions
     * amateurs, le jeu lui-même arrivant en quatorzième position.
     */
    @Test
    void the_exact_title_comes_first_even_when_bgg_lists_fan_expansions_before_it() {
        List<MetadataCandidate> deBgg = List.of(
                jeu("Am Pranger (Fan-Erweiterung zu Carcassonne)"),
                jeu("Angler & Fischfarm (Fan Erweiterung für Carcassonne)"),
                jeu("Carcassonne: Hunters and Gatherers"),
                jeu("New Carcassonne"),
                jeu("Carcassonne"));

        List<String> classes = BggMetadataProvider.classerParPertinence(deBgg, "Carcassonne")
                .stream().map(MetadataCandidate::title).toList();

        // Le titre exact, puis ceux qui COMMENCENT par la recherche. Au-delà,
        // l'ordre de BGG est conservé : distinguer « New Carcassonne » d'une
        // extension amateur demanderait de deviner ce qu'est une extension, et
        // ce dépôt ne devine pas.
        assertThat(classes).startsWith("Carcassonne", "Carcassonne: Hunters and Gatherers");
    }

    @Test
    void accents_do_not_change_the_ranking() {
        List<MetadataCandidate> deBgg = List.of(jeu("Autre jeu"), jeu("Baum fällt!"));

        List<String> classes = BggMetadataProvider.classerParPertinence(deBgg, "baum fallt!")
                .stream().map(MetadataCandidate::title).toList();

        assertThat(classes).startsWith("Baum fällt!");
    }

    /** BGG ne limite pas ses réponses ; l'écran de recherche, si - même plafond
     *  que le fournisseur manga. */
    @Test
    void only_the_first_results_are_kept() {
        List<MetadataCandidate> deBgg = java.util.stream.IntStream.range(0, 50)
                .mapToObj(i -> jeu("Jeu " + i))
                .toList();

        assertThat(BggMetadataProvider.classerParPertinence(deBgg, "Jeu")).hasSize(10);
    }
}
