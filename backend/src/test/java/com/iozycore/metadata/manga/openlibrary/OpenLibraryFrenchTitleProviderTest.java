package com.iozycore.metadata.manga.openlibrary;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OpenLibraryFrenchTitleProviderTest {

    @Test
    void treats_a_single_word_author_as_too_generic_for_the_author_only_fallback() {
        // Cas réel trouvé en continuant les tests sur "Akame ga Kill" (voir
        // historique) : "Takahiro" (mononyme, pseudonyme du scénariste)
        // remontait "Trapped Life" de "Haruki Takahiro", une personne
        // différente sans aucun rapport - un nom complet reste bien plus
        // distinctif.
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
        // Cas réel observé (voir historique) : "Dragon Ball Super nº 18"
        // ressort en PREMIER résultat pour "Dragon Ball" - sa suite, mieux
        // référencée sur Open Library, avant le vrai "Dragon Ball, tome 1".
        // "Dragon Ball Super" partage pourtant bien le préfixe "Dragon Ball" -
        // seule cette information externe (suite connue, voir
        // RelatedSeriesService) permet de l'écarter et de passer au suivant.
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
        // Même correctif que le jumeau GoogleBooksFrenchTitleProvider (voir
        // historique) : un titre séparé par un tiret plutôt qu'une virgule
        // laissait un tiret résiduel une fois le suffixe "Tome N" retiré.
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
        // Même correctif que le jumeau GoogleBooksFrenchTitleProvider (voir
        // historique) : "L'Art des Sorciers" (artbook sans rapport, même
        // auteur) avant "L'Atelier des Sorciers T15" (le vrai manga).
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
        // Même correctif que le jumeau GoogleBooksFrenchTitleProvider (voir
        // historique) : "Gloutons et Dragons (Tome 12)" (titre français réel
        // de "Delicious in Dungeon") avait son numéro PARENTHÉSÉ ignoré,
        // faisant retomber le dernier recours "auteur seul" sur "Les Sept
        // Rejetons du dragon", un autre livre du même auteur sans rapport.
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
        // Dernier recours "auteur seul" : rien de la série cherchée n'a
        // matché, un livre sans numéro de tome y est presque toujours un
        // artbook/guide/one-shot du même auteur - mieux vaut ne rien
        // remonter que de faire passer "Les Sept Rejetons du dragon" pour le
        // titre français de "Delicious in Dungeon". Le repli reste en place
        // aux étapes qui, elles, ont bien matché la série (voir
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
        // Cas réel trouvé en continuant les tests sur "Detective Conan" (voir
        // historique) : "language=fre" DANS LA REQUÊTE ne garantit QUE
        // l'existence d'une édition française parmi toutes celles de
        // l'œuvre - le "title" renvoyé reste le titre canonique, souvent en
        // japonais pour un manga ("名探偵コナン") - sans ce filet de
        // sécurité, la recherche de tomes qui suit repartait avec du
        // japonais comme "titre français", ne trouvant alors STRICTEMENT
        // AUCUN résultat.
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
