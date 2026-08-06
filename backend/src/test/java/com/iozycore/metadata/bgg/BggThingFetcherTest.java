package com.iozycore.metadata.bgg;

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
        assertThat(result).doesNotContain("Klaus Teuber"); // designer, pas une catégorie/mécanique
    }

    @Test
    void returns_an_empty_set_when_there_are_no_links() {
        BggThingFetcher fetcher = new BggThingFetcher();

        Set<String> result = fetcher.parse(
                "<items termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(result).isEmpty();
    }
}
