package com.iozycore.videogame.igdb;

import com.iozycore.core.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class IgdbMetadataProviderTest {

    private static final String SAMPLE_RESPONSE = """
            [
              {
                "id": 1029,
                "name": "The Legend of Zelda: Breath of the Wild",
                "cover": { "id": 55, "url": "//images.igdb.com/igdb/image/upload/t_thumb/co3p2d.jpg" },
                "platforms": [ { "id": 130, "name": "Nintendo Switch" } ],
                "involved_companies": [ { "id": 1, "company": { "id": 70, "name": "Nintendo" } } ]
              }
            ]
            """;

    @Test
    void parses_title_cover_and_attributes_from_an_igdb_response() throws Exception {
        // parse() never uses the tokenProvider - never search(), which alone would need it.
        IgdbMetadataProvider provider = new IgdbMetadataProvider(null);

        List<MetadataCandidate> candidates = provider.parse(SAMPLE_RESPONSE);

        assertThat(candidates).hasSize(1);
        MetadataCandidate candidate = candidates.get(0);
        assertThat(candidate.source()).isEqualTo("IGDB");
        assertThat(candidate.externalId()).isEqualTo("1029");
        assertThat(candidate.title()).isEqualTo("The Legend of Zelda: Breath of the Wild");
        // protocol-relative -> https, t_thumb -> t_cover_big (voir normalizeCoverUrl).
        assertThat(candidate.imageUrl())
                .isEqualTo("https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.jpg");
        assertThat(candidate.attributes()).containsEntry("igdbId", "1029");
        assertThat(candidate.attributes()).containsEntry("platform", "Nintendo Switch");
        assertThat(candidate.attributes()).containsEntry("studio", "Nintendo");
    }

    @Test
    void returns_an_empty_list_when_there_is_no_result() throws Exception {
        IgdbMetadataProvider provider = new IgdbMetadataProvider(null);

        List<MetadataCandidate> candidates = provider.parse("[]");

        assertThat(candidates).isEmpty();
    }

    /** Trimmed from what IGDB answered for Celeste on 2026-11-06. */
    private static final String CELESTE = """
            [{"id": 26226, "name": "Celeste",
              "platforms": [{"name": "Google Stadia"}, {"name": "PlayStation 4"}, {"name": "Nintendo Switch"}],
              "involved_companies": [
                {"publisher": false, "developer": true, "company": {"name": "Extremely OK Games"}},
                {"publisher": true, "developer": false, "company": {"name": "Maddy Makes Games"}},
                {"publisher": false, "developer": false, "company": {"name": "Sickhead Games"}}]}]
            """;

    @Test
    void keeps_every_console_and_reads_the_companies_by_their_role() throws Exception {
        Map<String, Object> attributes = new IgdbMetadataProvider(null).parse(CELESTE).get(0).attributes();

        assertThat(attributes).containsEntry("platforms", "Google Stadia, PlayStation 4, Nintendo Switch");
        assertThat(attributes).containsEntry("publisher", "Maddy Makes Games");
        assertThat(attributes).containsEntry("studio", "Extremely OK Games");
    }

    @Test
    void the_details_only_say_what_a_former_add_could_not_keep() throws Exception {
        Map<String, Object> details = new IgdbMetadataProvider(null).parseDetails(CELESTE);

        assertThat(details).containsOnlyKeys("platforms", "publisher");
    }

    @Test
    void a_game_without_a_known_publisher_has_none_rather_than_the_first_company() throws Exception {
        String body = """
                [{"id": 1, "name": "X", "involved_companies": [{"developer": true, "company": {"name": "Studio"}}]}]
                """;

        assertThat(new IgdbMetadataProvider(null).parse(body).get(0).attributes()).doesNotContainKey("publisher");
    }

    @Test
    void the_details_ask_nothing_without_a_numeric_id() {
        assertThat(new IgdbMetadataProvider(null).details(Map.of("igdbId", "1; fields *"))).isEmpty();
        assertThat(new IgdbMetadataProvider(null).details(Map.of())).isEmpty();
    }
}
