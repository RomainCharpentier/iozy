package com.iozycore.metadata.googlebooks;

import com.iozycore.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksVolumeSearchProviderTest {

    @Test
    void extracts_volume_number_and_falls_back_to_publisher_when_no_collection_name_remains() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        // Cas réel observé (voir historique) : le titre ne contient que la
        // série + le numéro de tome, rien à isoler comme nom de collection.
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Death Note - Tome 3", "language": "fr", "publisher": "Kana",
                        "imageLinks": { "thumbnail": "http://books.google.com/tome3.jpg" } } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Death Note");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(3);
        assertThat(result.get(0).edition()).isEqualTo("Kana"); // repli sur l'éditeur
        assertThat(result.get(0).imageUrl()).isEqualTo("https://books.google.com/tome3.jpg"); // forcé en https
    }

    @Test
    void extracts_a_real_collection_name_when_present_between_the_series_title_and_the_volume_number() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "One Piece - Édition originale - Tome 60", "language": "fr", "publisher": "Glénat Manga" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "One Piece");

        assertThat(result.get(0).edition()).isEqualTo("Édition originale");
        assertThat(result.get(0).volumeNumber()).isEqualTo(60);
    }

    @Test
    void excludes_single_chapter_digital_sales_even_with_a_volume_like_number() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "One Piece édition originale - Chapitre 648", "language": "fr", "publisher": "Glénat Manga" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "One Piece");

        assertThat(result).isEmpty();
    }

    @Test
    void excludes_results_not_actually_tagged_as_french_despite_langRestrict() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Death Note, Vol. 12", "language": "en", "publisher": "VIZ Media LLC" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Death Note");

        assertThat(result).isEmpty();
    }

    @Test
    void excludes_results_without_an_extractable_volume_number() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Death Note Complete Box Set", "language": "fr", "publisher": "Kana" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Death Note");

        assertThat(result).isEmpty();
    }

    @Test
    void deduplicates_same_edition_and_volume_preferring_the_result_with_a_cover() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Death Note - Tome 1", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "Death Note - Tome 1", "language": "fr", "publisher": "Kana",
                        "imageLinks": { "thumbnail": "http://books.google.com/tome1.jpg" } } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Death Note");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).imageUrl()).isNotNull();
    }

    @Test
    void sorts_results_by_edition_then_volume_number() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Death Note - Tome 10", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "Death Note - Tome 2", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "Death Note - Tome 1", "language": "fr", "publisher": "Kana" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Death Note");

        assertThat(result).extracting(VolumeCandidate::volumeNumber).containsExactly(1, 2, 10);
    }

    @Test
    void returns_empty_when_there_are_no_items() throws Exception {
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();

        List<VolumeCandidate> result = provider.parse("{}", "Death Note");

        assertThat(result).isEmpty();
    }
}
