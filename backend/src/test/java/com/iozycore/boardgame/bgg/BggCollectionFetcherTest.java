package com.iozycore.boardgame.bgg;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BggCollectionFetcherTest {

    private static final String SAMPLE_RESPONSE = """
            <?xml version="1.0" encoding="utf-8"?>
            <items totalitems="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
              <item objectid="13" subtype="boardgame" collid="1001">
                <name sortindex="1">Catan</name>
                <yearpublished>1995</yearpublished>
                <status own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0" lastmodified="2024-01-01 10:00:00"/>
              </item>
              <item objectid="822" subtype="boardgame" collid="1002">
                <name sortindex="1">Carcassonne</name>
                <yearpublished>2000</yearpublished>
                <status own="0" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="1" preordered="0" lastmodified="2024-01-01 10:00:00"/>
              </item>
            </items>
            """;

    @Test
    void only_owned_games_are_kept() {
        BggCollectionFetcher fetcher = new BggCollectionFetcher();

        List<BggCollectionItem> items = fetcher.parse(SAMPLE_RESPONSE);

        // Carcassonne is on the wishlist (own="0") - filtered out, only Catan (own="1") must stay.
        assertThat(items).hasSize(1);
        assertThat(items.get(0).title()).isEqualTo("Catan");
        assertThat(items.get(0).externalId()).isEqualTo("13");
        assertThat(items.get(0).yearPublished()).isEqualTo("1995");
    }

    @Test
    void reads_the_cover_players_and_playing_time_given_by_the_collection() {
        BggCollectionFetcher fetcher = new BggCollectionFetcher();

        List<BggCollectionItem> items = fetcher.parse("""
                <items totalitems="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
                  <item objectid="230802" subtype="boardgame" collid="2001">
                    <name sortindex="1">Azul</name>
                    <yearpublished>2017</yearpublished>
                    <image>https://cf.geekdo-images.com/azul/pic6973671.png</image>
                    <thumbnail>https://cf.geekdo-images.com/azul/pic6973671_t.png</thumbnail>
                    <stats minplayers="2" maxplayers="4" minplaytime="30" maxplaytime="45" playingtime="45" numowned="120000">
                      <rating value="N/A"><average value="7.7"/></rating>
                    </stats>
                    <status own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0" lastmodified="2024-01-01 10:00:00"/>
                  </item>
                  <item objectid="999" subtype="boardgame" collid="2002">
                    <name sortindex="1">Prototype</name>
                    <stats minplayers="0" maxplayers="0" playingtime="0" numowned="1"/>
                    <status own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0" lastmodified="2024-01-01 10:00:00"/>
                  </item>
                </items>
                """);

        assertThat(items).hasSize(2);
        BggCollectionItem azul = items.get(0);
        // The full image, not the thumbnail.
        assertThat(azul.imageUrl()).isEqualTo("https://cf.geekdo-images.com/azul/pic6973671.png");
        assertThat(azul.minPlayers()).isEqualTo(2);
        assertThat(azul.maxPlayers()).isEqualTo(4);
        assertThat(azul.playingTimeMinutes()).isEqualTo(45);

        // No image and "0" everywhere: the game is kept, the fields stay empty.
        BggCollectionItem prototype = items.get(1);
        assertThat(prototype.title()).isEqualTo("Prototype");
        assertThat(prototype.imageUrl()).isNull();
        assertThat(prototype.minPlayers()).isNull();
        assertThat(prototype.maxPlayers()).isNull();
        assertThat(prototype.playingTimeMinutes()).isNull();
    }

    @Test
    void returns_an_empty_list_when_nothing_is_owned() {
        BggCollectionFetcher fetcher = new BggCollectionFetcher();

        List<BggCollectionItem> items = fetcher.parse(
                "<items totalitems=\"0\" termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(items).isEmpty();
    }

    @Test
    void an_unknown_user_is_said_as_such_and_not_read_as_an_empty_collection() {
        BggCollectionFetcher fetcher = new BggCollectionFetcher();

        assertThatThrownBy(() -> fetcher.parse(
                "<errors><error><message>Invalid username specified</message></error></errors>"))
                .isInstanceOf(BggCollectionFetcher.BggCollectionUnavailableException.class)
                .hasMessage("Ce pseudo n'existe pas sur BoardGameGeek.");
    }

    @Test
    void any_other_bgg_error_is_reported_and_not_read_as_an_empty_collection() {
        BggCollectionFetcher fetcher = new BggCollectionFetcher();

        assertThatThrownBy(() -> fetcher.parse(
                "<errors><error><message>Rate limit exceeded</message></error></errors>"))
                .isInstanceOf(BggCollectionFetcher.BggCollectionUnavailableException.class)
                .hasMessageStartingWith("BoardGameGeek a refusé la demande");
    }
}
