package com.iozycore.metadata.openlibrary;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OpenLibraryFrenchTitleProviderTest {

    @Test
    void returns_the_cleaned_title_of_the_first_result() throws Exception {
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "L'Attaque des Titans Vol. 13", "language": ["fre"] },
                    { "title": "Shingeki no Kyojin", "language": ["jpn"] }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("L'Attaque des Titans");
    }

    @Test
    void returns_empty_when_there_are_no_results() throws Exception {
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();

        Optional<String> result = provider.parse("{ \"docs\": [] }");

        assertThat(result).isEmpty();
    }

    @Test
    void strips_a_trailing_volume_or_tome_marker() {
        assertThat(OpenLibraryFrenchTitleProvider.cleanVolumeSuffix("Death Note, Vol. 1")).isEqualTo("Death Note");
        assertThat(OpenLibraryFrenchTitleProvider.cleanVolumeSuffix("Naruto Tome 5")).isEqualTo("Naruto");
        assertThat(OpenLibraryFrenchTitleProvider.cleanVolumeSuffix("L'Attaque des Titans Vol. 13"))
                .isEqualTo("L'Attaque des Titans");
    }

    @Test
    void strips_a_bare_trailing_volume_number() {
        assertThat(OpenLibraryFrenchTitleProvider.cleanVolumeSuffix("Naruto 58")).isEqualTo("Naruto");
        assertThat(OpenLibraryFrenchTitleProvider.cleanVolumeSuffix("Naruto 01")).isEqualTo("Naruto");
    }

    @Test
    void leaves_a_title_without_any_volume_marker_untouched() {
        assertThat(OpenLibraryFrenchTitleProvider.cleanVolumeSuffix("Boruto")).isEqualTo("Boruto");
    }

    // "Attack on Titan" -> auteur+titre complet ne matche jamais une édition
    // française traduite (voir le commentaire de classe pour le pourquoi) -
    // "Titan" doit rester un candidat essayé isolément, "on" doit être
    // exclu (mot vide) même s'il fait 2 caractères de moins que le seuil.
    @Test
    void extracts_significant_words_excluding_stopwords_and_short_words() {
        assertThat(OpenLibraryFrenchTitleProvider.significantWords("Attack on Titan")).containsExactly("Attack", "Titan");
    }

    @Test
    void excludes_common_manga_vocabulary_and_romaji_particles() {
        assertThat(OpenLibraryFrenchTitleProvider.significantWords("Boruto: Naruto Next Generations"))
                .containsExactly("Boruto", "Naruto");
    }

    @Test
    void caps_the_number_of_candidate_words_to_limit_external_calls() {
        List<String> words = OpenLibraryFrenchTitleProvider.significantWords("Alpha Beta Gamma Delta Epsilon Zeta");

        assertThat(words).hasSize(3);
    }

    @Test
    void excludes_pure_numbers_and_deduplicates() {
        assertThat(OpenLibraryFrenchTitleProvider.significantWords("Naruto 2020 Naruto")).containsExactly("Naruto");
    }
}
