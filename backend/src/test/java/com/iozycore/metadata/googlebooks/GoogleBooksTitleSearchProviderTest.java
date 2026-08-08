package com.iozycore.metadata.googlebooks;

import com.iozycore.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksTitleSearchProviderTest {

    @Test
    void extracts_title_author_publisher_and_cover_from_a_match() throws Exception {
        GoogleBooksTitleSearchProvider provider = new GoogleBooksTitleSearchProvider();
        String body = """
                {
                  "items": [
                    { "id": "abc123", "volumeInfo": { "title": "Fragments d'elles Tome 2", "language": "fr",
                        "authors": ["Mag Hsu", "Nao Emoto"], "publisher": "Pika",
                        "imageLinks": { "thumbnail": "http://books.google.com/cover.jpg" } } }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result).hasSize(1);
        MetadataCandidate candidate = result.get(0);
        assertThat(candidate.source()).isEqualTo("GOOGLE_BOOKS");
        assertThat(candidate.externalId()).isEqualTo("abc123");
        assertThat(candidate.title()).isEqualTo("Fragments d'elles");
        assertThat(candidate.imageUrl()).isEqualTo("https://books.google.com/cover.jpg");
        assertThat(candidate.attributes()).containsEntry("mangaka", "Mag Hsu");
        assertThat(candidate.attributes()).containsEntry("publisher", "Pika");
    }

    @Test
    void strips_both_the_spelled_out_and_abbreviated_volume_suffix_and_deduplicates_the_series() throws Exception {
        // Cas réel observé (voir historique) : Google Books mélange "Tome N"
        // et l'abrégé "TNN" (sans point) pour la même série.
        GoogleBooksTitleSearchProvider provider = new GoogleBooksTitleSearchProvider();
        String body = """
                {
                  "items": [
                    { "id": "a", "volumeInfo": { "title": "Fragments d'elles Tome 2", "language": "fr" } },
                    { "id": "b", "volumeInfo": { "title": "Fragments d'elles T01", "language": "fr" } }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result).hasSize(1); // une seule série, pas un candidat par tome
        assertThat(result.get(0).title()).isEqualTo("Fragments d'elles");
    }

    @Test
    void excludes_results_not_actually_tagged_as_french_despite_langRestrict() throws Exception {
        GoogleBooksTitleSearchProvider provider = new GoogleBooksTitleSearchProvider();
        String body = """
                {
                  "items": [
                    { "id": "a", "volumeInfo": { "title": "Forget Me Not", "language": "en" } }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result).isEmpty();
    }

    @Test
    void skips_entries_without_an_id_or_a_title() throws Exception {
        GoogleBooksTitleSearchProvider provider = new GoogleBooksTitleSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Sans id", "language": "fr" } },
                    { "id": "a", "volumeInfo": { "language": "fr" } }
                  ]
                }
                """;

        List<MetadataCandidate> result = provider.parse(body);

        assertThat(result).isEmpty();
    }

    @Test
    void returns_empty_when_there_are_no_items() throws Exception {
        GoogleBooksTitleSearchProvider provider = new GoogleBooksTitleSearchProvider();

        List<MetadataCandidate> result = provider.parse("{}");

        assertThat(result).isEmpty();
    }

    @Test
    void supports_only_manga() {
        GoogleBooksTitleSearchProvider provider = new GoogleBooksTitleSearchProvider();

        assertThat(provider.supports(com.iozycore.domain.catalog.EntityTypeFixtures.MANGA)).isTrue();
        assertThat(provider.supports(com.iozycore.domain.catalog.EntityTypeFixtures.VIDEO_GAME)).isFalse();
    }
}
