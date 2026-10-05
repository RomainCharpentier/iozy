package com.iozycore.manga.metadata.openlibrary;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OpenLibraryFrenchTitleProviderTest {

    @Test
    void treats_a_single_word_author_as_too_generic_for_the_author_only_fallback() {
        // Real case found while continuing the tests on "Akame ga Kill" (see
        // history): "Takahiro" (mononym, pen name of the writer)
        // returned "Trapped Life" by "Haruki Takahiro", a
        // different person with no connection - a full name stays much more
        // distinctive.
        assertThat(OpenLibraryFrenchTitleProvider.isTooGenericForAuthorOnlySearch("Takahiro")).isTrue();
        assertThat(OpenLibraryFrenchTitleProvider.isTooGenericForAuthorOnlySearch("Akira Toriyama")).isFalse();
    }

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
    void skips_a_known_related_series_and_falls_through_to_the_next_result() throws Exception {
        // Real case observed (see history): "Dragon Ball Super nº 18"
        // comes out as the FIRST result for "Dragon Ball" - its sequel, better
        // referenced on Open Library, before the real "Dragon Ball, tome 1".
        // "Dragon Ball Super" does share the prefix "Dragon Ball" -
        // only this external information (known sequel, see
        // RelatedSeriesService) allows us to discard it and move to the next one.
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "Dragon Ball Super nº 18", "language": ["fre"] },
                    { "title": "Dragon Ball, tome 1", "language": ["fre"] }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body, List.of("Dragon Ball Super"));

        assertThat(result).contains("Dragon Ball");
    }

    @Test
    void strips_a_dash_separated_tome_suffix_without_leaving_a_dangling_dash() throws Exception {
        // Same fix as the twin GoogleBooksFrenchTitleProvider (see
        // history): a title separated by a dash rather than a comma
        // left a leftover dash once the suffix "Tome N" was removed.
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "Détective Conan - Tome 14", "language": ["fre"] }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Détective Conan");
    }

    @Test
    void prefers_a_tome_numbered_result_over_an_unrelated_homonym_from_the_same_author() throws Exception {
        // Same fix as the twin GoogleBooksFrenchTitleProvider (see
        // history): "L'Art des Sorciers" (unrelated artbook, same
        // author) before "L'Atelier des Sorciers T15" (the real manga).
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "L'Art des Sorciers", "language": ["fre"] },
                    { "title": "L'Atelier des Sorciers T15", "language": ["fre"] }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("L'Atelier des Sorciers");
    }

    @Test
    void recognizes_a_parenthesized_tome_number_as_a_real_series_entry() throws Exception {
        // Same fix as the twin GoogleBooksFrenchTitleProvider (see
        // history): "Gloutons et Dragons (Tome 12)" (real French title
        // of "Delicious in Dungeon") had its PARENTHESISED number ignored,
        // making the last resort "author only" fall back on "Les Sept
        // Rejetons du dragon", another unrelated book by the same author.
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "Les Sept Rejetons du dragon", "language": ["fre"] },
                    { "title": "Gloutons et Dragons (Tome 12)", "language": ["fre"] }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Gloutons et Dragons");
    }

    @Test
    void falls_back_to_the_first_result_when_none_has_an_extractable_tome_number() throws Exception {
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "Fragments d'elles", "language": ["fre"] },
                    { "title": "Un autre livre", "language": ["fre"] }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Fragments d'elles");
    }

    @Test
    void refuses_a_result_without_a_tome_number_when_only_the_author_name_matched() throws Exception {
        // Last resort "author only": nothing of the searched series
        // matched, a book without a volume number there is almost always an
        // artbook/guide/one-shot by the same author - better to return nothing
        // than to pass "Les Sept Rejetons du dragon" off as the
        // French title of "Delicious in Dungeon". The fallback stays in place
        // at the steps that did match the series (see
        // falls_back_to_the_first_result_when_none_has_an_extractable_tome_number).
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "Les Sept Rejetons du dragon", "language": ["fre"] }
                  ]
                }
                """;

        assertThat(provider.parse(body, List.of(), true)).isEmpty();
        assertThat(provider.parse(body, List.of(), false)).contains("Les Sept Rejetons du dragon");
    }

    @Test
    void skips_a_result_whose_title_is_actually_in_japanese_and_falls_through_to_the_next_one() throws Exception {
        // Real case found while continuing the tests on "Detective Conan" (see
        // history): "language=fre" IN THE QUERY only guarantees
        // the existence of a French edition among all those of
        // the work - the returned "title" stays the canonical title, often in
        // Japanese for a manga ("名探偵コナン") - without this safety
        // net, the volume search that follows set off with
        // Japanese as the "French title", then finding STRICTLY
        // NO result.
        OpenLibraryFrenchTitleProvider provider = new OpenLibraryFrenchTitleProvider();
        String body = """
                {
                  "docs": [
                    { "title": "名探偵コナン 1", "language": ["jpn", "fre"] },
                    { "title": "Détective Conan, tome 1", "language": ["fre"] }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Détective Conan");
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

    // "Attack on Titan" -> author + full title never matches a translated
    // French edition (see the class comment for why) -
    // "Titan" must stay a candidate tried on its own, "on" must be
    // excluded (stop word) even if it is 2 characters under the threshold.
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
