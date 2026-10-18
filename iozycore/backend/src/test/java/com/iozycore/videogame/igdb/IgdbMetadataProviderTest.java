package com.iozycore.videogame.igdb;

import com.iozycore.core.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

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
}
