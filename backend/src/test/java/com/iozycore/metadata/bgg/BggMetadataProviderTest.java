package com.iozycore.metadata.bgg;

import com.iozycore.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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
        BggMetadataProvider provider = new BggMetadataProvider();

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
        BggMetadataProvider provider = new BggMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse(
                "<items total=\"0\" termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\"></items>");

        assertThat(candidates).isEmpty();
    }
}
