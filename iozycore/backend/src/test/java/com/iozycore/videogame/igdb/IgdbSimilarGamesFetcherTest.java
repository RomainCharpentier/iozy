package com.iozycore.videogame.igdb;

import com.iozycore.core.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IgdbSimilarGamesFetcherTest {

    private static final String SAMPLE_RESPONSE = """
            [
              {
                "id": 1029,
                "similar_games": [
                  { "id": 7346, "name": "Tunic", "cover": { "url": "//images.igdb.com/igdb/image/upload/t_thumb/co3xyz.jpg" } },
                  { "id": 8123, "name": "Hollow Knight" }
                ]
              }
            ]
            """;

    @Test
    void parses_similar_games_with_and_without_cover() throws Exception {
        IgdbSimilarGamesFetcher fetcher = new IgdbSimilarGamesFetcher(null);

        List<MetadataCandidate> candidates = fetcher.parse(SAMPLE_RESPONSE);

        assertThat(candidates).hasSize(2);
        assertThat(candidates.get(0).source()).isEqualTo("IGDB");
        assertThat(candidates.get(0).externalId()).isEqualTo("7346");
        assertThat(candidates.get(0).title()).isEqualTo("Tunic");
        assertThat(candidates.get(0).imageUrl())
                .isEqualTo("https://images.igdb.com/igdb/image/upload/t_cover_big/co3xyz.jpg");
        assertThat(candidates.get(1).title()).isEqualTo("Hollow Knight");
        assertThat(candidates.get(1).imageUrl()).isNull();
    }

    @Test
    void returns_an_empty_list_when_the_source_game_has_no_similar_games() throws Exception {
        IgdbSimilarGamesFetcher fetcher = new IgdbSimilarGamesFetcher(null);

        List<MetadataCandidate> candidates = fetcher.parse("[ { \"id\": 1029 } ]");

        assertThat(candidates).isEmpty();
    }
}
