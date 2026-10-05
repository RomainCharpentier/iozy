package com.iozycore.manga.metadata.googlebooks;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksFrenchTitleProviderTest {

    @Test
    void treats_a_single_word_author_as_too_generic_for_the_author_only_fallback() {
        // Real case found while continuing the tests on "Akame ga Kill" (see
        // history): inauthor:"Takahiro" (mononym, pen name of the
        // writer) also matched "Takahiro Arai", illustrator of an
        // adaptation of Les Misérables - a different person with no
        // connection.
        assertThat(GoogleBooksFrenchTitleProvider.isTooGenericForAuthorOnlySearch("Takahiro")).isTrue();
        assertThat(GoogleBooksFrenchTitleProvider.isTooGenericForAuthorOnlySearch("Akira Toriyama")).isFalse();
    }

    @Test
    void returns_the_title_of_the_first_french_language_result() throws Exception {
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 2,
                  "items": [
                    { "volumeInfo": { "title": "L'Attaque des Titans", "language": "fr" } },
                    { "volumeInfo": { "title": "Attack on Titan", "language": "en" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("L'Attaque des Titans");
    }

    @Test
    void strips_a_dash_separated_tome_suffix_without_leaving_a_dangling_dash() throws Exception {
        // Real case found while continuing the tests on "Detective Conan" (see
        // history): "Détective Conan - Tome 14" (dash, not comma)
        // left "Détective Conan -" once the suffix "Tome 14" was removed -
        // the leftover dash then prevented any prefix match on the
        // volume search side (66 results without it, only 2 with it).
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 1,
                  "items": [
                    { "volumeInfo": { "title": "Détective Conan - Tome 14", "language": "fr" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Détective Conan");
    }

    @Test
    void skips_results_not_actually_tagged_as_french_despite_langRestrict() throws Exception {
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 1,
                  "items": [
                    { "volumeInfo": { "title": "Attack on Titan", "language": "en" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).isEmpty();
    }

    @Test
    void returns_empty_when_there_are_no_results() throws Exception {
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();

        Optional<String> result = provider.parse("{ \"totalItems\": 0 }");

        assertThat(result).isEmpty();
    }

    @Test
    void strips_the_volume_suffix_from_the_matched_title() throws Exception {
        // Real case observed (see history): Google Books indexes the scanned
        // volume ("Fragments d'elles T04"), not the series - we only want the
        // series title to pre-fill the addition.
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 1,
                  "items": [
                    { "volumeInfo": { "title": "Fragments d'elles T04", "language": "fr" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Fragments d'elles");
    }

    @Test
    void prefers_a_tome_numbered_result_over_an_unrelated_homonym_from_the_same_author() throws Exception {
        // Real case found while continuing the tests on "Witch Hat Atelier"
        // (see history): the "author only" fallback (see findFrenchTitle)
        // returns FIRST "L'Art des Sorciers", an unrelated ARTBOOK
        // by the same author (Kamome Shirahama), before "L'Atelier des Sorciers
        // T15" (the real manga, correctly numbered) a bit further in
        // the same results - an extracted volume number is a much
        // stronger signal than a simple first position.
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 2,
                  "items": [
                    { "volumeInfo": { "title": "L'Art des Sorciers", "language": "fr" } },
                    { "volumeInfo": { "title": "L'Atelier des Sorciers T15", "language": "fr" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("L'Atelier des Sorciers");
    }

    @Test
    void recognizes_a_parenthesized_tome_number_as_a_real_series_entry() throws Exception {
        // Real case found while continuing the tests on "Delicious in Dungeon"
        // (see history): "Gloutons et Dragons (Tome 12)" is the real
        // French title, but the PARENTHESISED number was not recognised by
        // VOLUME_SUFFIX - the "author only" fallback then fell back on "Les
        // Sept Rejetons du dragon", another book by the same author WITHOUT a
        // volume number, which then wrongly seemed "preferable".
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 2,
                  "items": [
                    { "volumeInfo": { "title": "Les Sept Rejetons du dragon", "language": "fr" } },
                    { "volumeInfo": { "title": "Gloutons et Dragons (Tome 12)", "language": "fr" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Gloutons et Dragons");
    }

    @Test
    void refuses_a_result_without_a_tome_number_when_only_the_author_name_matched() throws Exception {
        // Last resort "author only" (inauthor:): checked live on
        // inauthor:"Ryoko Kui" - "Les Sept Rejetons du dragon" AND "Gloutons
        // et Dragons : guide officiel" come BEFORE "Gloutons et Dragons
        // (Tome 12)". Without a volume number, a result of this step is
        // linked to the searched series by strictly nothing.
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 1,
                  "items": [
                    { "volumeInfo": { "title": "Les Sept Rejetons du dragon", "language": "fr" } }
                  ]
                }
                """;

        assertThat(provider.parse(body, List.of(), true)).isEmpty();
        assertThat(provider.parse(body, List.of(), false)).contains("Les Sept Rejetons du dragon");
    }

    @Test
    void falls_back_to_the_first_result_when_none_has_an_extractable_tome_number() throws Exception {
        // Unlike the case above: if NO result has a volume
        // number (e.g. a real one-shot with never a "Tome 1" record
        // indexed), the behaviour stays unchanged - first result
        // kept as is rather than discarding everything.
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 2,
                  "items": [
                    { "volumeInfo": { "title": "Fragments d'elles", "language": "fr" } },
                    { "volumeInfo": { "title": "Un autre livre", "language": "fr" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body);

        assertThat(result).contains("Fragments d'elles");
    }

    @Test
    void skips_a_known_related_series_and_falls_through_to_the_next_result() throws Exception {
        // Same popularity bias as on the Open Library side (see
        // OpenLibraryFrenchTitleProviderTest, "Dragon Ball Super nº 18" for
        // a "Dragon Ball" search) - possible here too as a fallback.
        GoogleBooksFrenchTitleProvider provider = new GoogleBooksFrenchTitleProvider();
        String body = """
                {
                  "totalItems": 2,
                  "items": [
                    { "volumeInfo": { "title": "Dragon Ball Super - Tome 18", "language": "fr" } },
                    { "volumeInfo": { "title": "Dragon Ball, tome 1", "language": "fr" } }
                  ]
                }
                """;

        Optional<String> result = provider.parse(body, List.of("Dragon Ball Super"));

        assertThat(result).contains("Dragon Ball");
    }
}
