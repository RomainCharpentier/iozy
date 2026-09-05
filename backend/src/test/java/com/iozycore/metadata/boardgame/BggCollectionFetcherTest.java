package com.iozycore.metadata.boardgame;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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

        // Carcassonne est en wishlist (own="0") - filtré, seul Catan (own="1") doit rester.
        assertThat(items).hasSize(1);
        assertThat(items.get(0).title()).isEqualTo("Catan");
        assertThat(items.get(0).externalId()).isEqualTo("13");
        assertThat(items.get(0).yearPublished()).isEqualTo("1995");
    }

    @Test
    void returns_an_empty_list_when_nothing_is_owned() {
        BggCollectionFetcher fetcher = new BggCollectionFetcher();

        List<BggCollectionItem> items = fetcher.parse(
                "<items totalitems=\"0\" termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(items).isEmpty();
    }
}
