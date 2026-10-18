package com.iozycore.boardgame.bgg;

import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
        BggMetadataProvider provider = new BggMetadataProvider(new BggThingFetcher());

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
        BggMetadataProvider provider = new BggMetadataProvider(new BggThingFetcher());

        List<MetadataCandidate> candidates = provider.parse(
                "<items total=\"0\" termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(candidates).isEmpty();
    }

    @Test
    void details_put_the_cover_under_the_shared_key_and_players_under_the_type_keys() {
        CountingThingFetcher fetcher = new CountingThingFetcher(new BggThing(
                "https://cf.geekdo-images.com/original/pic.png", "2000", 2, 5, 45,
                List.of("Klaus-Jürgen Wrede", "Someone Else"), java.util.Set.of("Medieval")));

        java.util.Map<String, Object> details = new BggMetadataProvider(fetcher)
                .details(java.util.Map.of("bggId", "822", "yearPublished", "2000"));

        assertThat(fetcher.askedIds).containsExactly("822");
        assertThat(details)
                .containsEntry("coverImageUrl", "https://cf.geekdo-images.com/original/pic.png")
                .containsEntry("minPlayers", 2)
                .containsEntry("maxPlayers", 5)
                .containsEntry("averageDurationMinutes", 45)
                .containsEntry("designers", "Klaus-Jürgen Wrede, Someone Else")
                .doesNotContainKey("categoriesAndMechanics");
    }

    @Test
    void details_of_a_game_without_bgg_id_cost_no_call() {
        CountingThingFetcher fetcher = new CountingThingFetcher(null);

        assertThat(new BggMetadataProvider(fetcher).details(java.util.Map.of("yearPublished", "2000"))).isEmpty();
        assertThat(fetcher.askedIds).isEmpty();
    }

    @Test
    void details_say_when_bgg_is_silent_instead_of_answering_nothing() {
        BggThingFetcher silent = new BggThingFetcher() {
            @Override
            public BggThing fetchThing(String bggId) {
                throw new SourceUnavailableException("BGG answered 503 for /thing?id=" + bggId);
            }
        };

        assertThatThrownBy(() -> new BggMetadataProvider(silent).details(java.util.Map.of("bggId", "822")))
                .isInstanceOf(SourceUnavailableException.class);
    }

    private static class CountingThingFetcher extends BggThingFetcher {
        private final BggThing answer;
        final List<String> askedIds = new java.util.ArrayList<>();

        CountingThingFetcher(BggThing answer) {
            this.answer = answer;
        }

        @Override
        public BggThing fetchThing(String bggId) {
            askedIds.add(bggId);
            return answer;
        }
    }

    private static MetadataCandidate jeu(String titre) {
        return new MetadataCandidate("BGG", titre, titre, null, java.util.Map.of());
    }

    /**
     * Seen when searching for "Carcassonne" in the app: BGG returned 144
     * rows in ITS order - alphabetical - opened by thirteen fan-made
     * expansions, with the game itself in fourteenth position.
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

        // The exact title, then those that START with the search. Beyond that,
        // BGG's order is kept: telling "New Carcassonne" from a fan-made
        // expansion would mean guessing what an expansion is, and
        // this repo does not guess.
        assertThat(classes).startsWith("Carcassonne", "Carcassonne: Hunters and Gatherers");
    }

    @Test
    void accents_do_not_change_the_ranking() {
        List<MetadataCandidate> deBgg = List.of(jeu("Autre jeu"), jeu("Baum fällt!"));

        List<String> classes = BggMetadataProvider.classerParPertinence(deBgg, "baum fallt!")
                .stream().map(MetadataCandidate::title).toList();

        assertThat(classes).startsWith("Baum fällt!");
    }

    /** BGG does not limit its answers; the search screen does - same cap
     *  as the manga provider. */
    @Test
    void only_the_first_results_are_kept() {
        List<MetadataCandidate> deBgg = java.util.stream.IntStream.range(0, 50)
                .mapToObj(i -> jeu("Jeu " + i))
                .toList();

        assertThat(BggMetadataProvider.classerParPertinence(deBgg, "Jeu")).hasSize(10);
    }
}
