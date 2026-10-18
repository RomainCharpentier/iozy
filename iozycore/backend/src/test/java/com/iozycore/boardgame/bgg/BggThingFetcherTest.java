package com.iozycore.boardgame.bgg;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class BggThingFetcherTest {

    private static final String SAMPLE_RESPONSE = """
            <?xml version="1.0" encoding="utf-8"?>
            <items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
              <item type="boardgame" id="13">
                <name type="primary" value="Catan"/>
                <link type="boardgamecategory" id="1021" value="Economic"/>
                <link type="boardgamecategory" id="1097" value="Negotiation"/>
                <link type="boardgamemechanic" id="2015" value="Trading"/>
                <link type="boardgamedesigner" id="6" value="Klaus Teuber"/>
              </item>
            </items>
            """;

    @Test
    void extracts_categories_and_mechanics_but_ignores_other_link_types() {
        BggThingFetcher fetcher = new BggThingFetcher();

        Set<String> result = fetcher.parse(SAMPLE_RESPONSE);

        assertThat(result).containsExactlyInAnyOrder("Economic", "Negotiation", "Trading");
        assertThat(result).doesNotContain("Klaus Teuber"); // designer, not a category/mechanic
    }

    private static final String CARCASSONNE = """
            <?xml version="1.0" encoding="utf-8"?>
            <items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
              <item type="boardgame" id="822">
                <thumbnail>https://cf.geekdo-images.com/thumb/pic6544250.png</thumbnail>
                <image>
                  https://cf.geekdo-images.com/original/pic6544250.png
                </image>
                <name type="primary" sortindex="1" value="Carcassonne"/>
                <yearpublished value="2000"/>
                <minplayers value="2"/>
                <maxplayers value="5"/>
                <playingtime value="45"/>
                <minage value="0"/>
                <link type="boardgamecategory" id="1035" value="Medieval"/>
                <link type="boardgamemechanic" id="2002" value="Tile Placement"/>
                <link type="boardgamedesigner" id="398" value="Klaus-Jürgen Wrede"/>
                <link type="boardgameartist" id="11825" value="Doris Matthäus"/>
              </item>
            </items>
            """;

    @Test
    void reads_the_cover_players_time_and_designers_of_a_game() {
        BggThing thing = new BggThingFetcher().parseThing(CARCASSONNE);

        // The full image, not the thumbnail, and without the line breaks BGG puts around it.
        assertThat(thing.imageUrl()).isEqualTo("https://cf.geekdo-images.com/original/pic6544250.png");
        assertThat(thing.yearPublished()).isEqualTo("2000");
        assertThat(thing.minPlayers()).isEqualTo(2);
        assertThat(thing.maxPlayers()).isEqualTo(5);
        assertThat(thing.playingTimeMinutes()).isEqualTo(45);
        assertThat(thing.designers()).containsExactly("Klaus-Jürgen Wrede"); // not the artist
        assertThat(thing.categoriesAndMechanics()).containsExactlyInAnyOrder("Medieval", "Tile Placement");
    }

    @Test
    void a_field_bgg_leaves_at_zero_or_uncredited_is_no_answer() {
        BggThing thing = new BggThingFetcher().parseThing("""
                <items><item type="boardgame" id="1">
                  <minplayers value="0"/><maxplayers value="0"/><playingtime value="0"/>
                  <link type="boardgamedesigner" id="3" value="(Uncredited)"/>
                </item></items>
                """);

        assertThat(thing.imageUrl()).isNull();
        assertThat(thing.minPlayers()).isNull();
        assertThat(thing.maxPlayers()).isNull();
        assertThat(thing.playingTimeMinutes()).isNull();
        assertThat(thing.designers()).isEmpty();
    }

    @Test
    void returns_an_empty_set_when_there_are_no_links() {
        BggThingFetcher fetcher = new BggThingFetcher();

        Set<String> result = fetcher.parse(
                "<items termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(result).isEmpty();
    }
}
