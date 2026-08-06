package com.iozycore.metadata.jikan;

import com.iozycore.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JikanMetadataProviderTest {

    private static final String SAMPLE_RESPONSE = """
            {
              "data": [
                {
                  "mal_id": 2,
                  "title": "Death Note",
                  "images": { "jpg": { "image_url": "https://example.com/deathnote.jpg" } },
                  "authors": [ { "name": "Ohba, Tsugumi" } ],
                  "serializations": [ { "name": "Weekly Shonen Jump" } ],
                  "status": "Finished"
                }
              ]
            }
            """;

    @Test
    void parses_title_image_and_attributes_from_a_jikan_response() throws Exception {
        JikanMetadataProvider provider = new JikanMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse(SAMPLE_RESPONSE);

        assertThat(candidates).hasSize(1);
        MetadataCandidate candidate = candidates.get(0);
        assertThat(candidate.source()).isEqualTo("JIKAN");
        assertThat(candidate.externalId()).isEqualTo("2");
        assertThat(candidate.title()).isEqualTo("Death Note");
        assertThat(candidate.imageUrl()).isEqualTo("https://example.com/deathnote.jpg");
        assertThat(candidate.attributes()).containsEntry("mangaka", "Ohba, Tsugumi");
        assertThat(candidate.attributes()).containsEntry("publisher", "Weekly Shonen Jump");
    }

    @Test
    void returns_an_empty_list_when_there_is_no_result() throws Exception {
        JikanMetadataProvider provider = new JikanMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse("{ \"data\": [] }");

        assertThat(candidates).isEmpty();
    }
}
