package com.iozycore.metadata.openlibrary;

import com.iozycore.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OpenLibraryTitleSearchProviderTest {

    @Test
    void extracts_title_author_publisher_and_cover_from_a_match() throws Exception {
        OpenLibraryTitleSearchProvider provider = new OpenLibraryTitleSearchProvider();
        String body = """
                {
                  "docs": [
                    { "key": "/works/OL123W", "title": "Fragments d'elles",
                      "author_name": ["Nao Emoto"], "publisher": ["Pika"], "cover_i": 456789 }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result).hasSize(1);
        MetadataCandidate candidate = result.get(0);
        assertThat(candidate.source()).isEqualTo("OPEN_LIBRARY");
        assertThat(candidate.externalId()).isEqualTo("/works/OL123W");
        assertThat(candidate.title()).isEqualTo("Fragments d'elles");
        assertThat(candidate.imageUrl()).isEqualTo("https://covers.openlibrary.org/b/id/456789-M.jpg");
        assertThat(candidate.attributes()).containsEntry("mangaka", "Nao Emoto");
        assertThat(candidate.attributes()).containsEntry("publisher", "Pika");
    }

    @Test
    void strips_the_volume_suffix_and_deduplicates_several_tomes_of_the_same_series() throws Exception {
        OpenLibraryTitleSearchProvider provider = new OpenLibraryTitleSearchProvider();
        String body = """
                {
                  "docs": [
                    { "key": "/works/OL1W", "title": "Fragments d'elles, Vol. 1" },
                    { "key": "/works/OL2W", "title": "Fragments d'elles, Vol. 2" }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result).hasSize(1); // une seule série, pas un candidat par tome
        assertThat(result.get(0).title()).isEqualTo("Fragments d'elles");
    }

    @Test
    void has_no_image_url_when_there_is_no_cover() throws Exception {
        OpenLibraryTitleSearchProvider provider = new OpenLibraryTitleSearchProvider();
        String body = """
                {
                  "docs": [
                    { "key": "/works/OL1W", "title": "Fragments d'elles" }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result.get(0).imageUrl()).isNull();
    }

    @Test
    void skips_entries_without_a_title_or_a_key() throws Exception {
        OpenLibraryTitleSearchProvider provider = new OpenLibraryTitleSearchProvider();
        String body = """
                {
                  "docs": [
                    { "key": "/works/OL1W" },
                    { "title": "Sans clé" },
                    { "key": "/works/OL2W", "title": "" }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result).isEmpty();
    }

    @Test
    void returns_empty_when_there_are_no_docs() throws Exception {
        OpenLibraryTitleSearchProvider provider = new OpenLibraryTitleSearchProvider();

        List<MetadataCandidate> result = provider.parse("{}");

        assertThat(result).isEmpty();
    }

    @Test
    void supports_only_manga() {
        OpenLibraryTitleSearchProvider provider = new OpenLibraryTitleSearchProvider();

        assertThat(provider.supports(com.iozycore.domain.catalog.EntityTypeFixtures.MANGA)).isTrue();
        assertThat(provider.supports(com.iozycore.domain.catalog.EntityTypeFixtures.VIDEO_GAME)).isFalse();
    }
}
