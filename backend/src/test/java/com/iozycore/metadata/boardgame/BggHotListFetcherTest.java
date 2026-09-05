package com.iozycore.metadata.boardgame;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BggHotListFetcherTest {

    private static final String SAMPLE_RESPONSE = """
            <?xml version="1.0" encoding="utf-8"?>
            <items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
              <item id="342942" rank="1">
                <thumbnail value="https://example.com/thumb.jpg"/>
                <name value="Arcs"/>
                <yearpublished value="2024"/>
              </item>
              <item id="366013" rank="2">
                <name value="Sky Team"/>
                <yearpublished value="2023"/>
              </item>
            </items>
            """;

    @Test
    void extracts_id_and_title_for_each_hot_item() {
        BggHotListFetcher fetcher = new BggHotListFetcher();

        List<BggCollectionItem> items = fetcher.parse(SAMPLE_RESPONSE);

        assertThat(items).hasSize(2);
        assertThat(items.get(0).externalId()).isEqualTo("342942");
        assertThat(items.get(0).title()).isEqualTo("Arcs");
        assertThat(items.get(1).title()).isEqualTo("Sky Team");
    }

    @Test
    void returns_an_empty_list_when_there_are_no_items() {
        BggHotListFetcher fetcher = new BggHotListFetcher();

        List<BggCollectionItem> items = fetcher.parse(
                "<items termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(items).isEmpty();
    }
}
