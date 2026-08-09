package com.iozycore.metadata.googlebooks;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksFrenchTitleProviderTest {

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
        // Cas réel trouvé en continuant les tests sur "Detective Conan" (voir
        // historique) : "Détective Conan - Tome 14" (tiret, pas virgule)
        // laissait "Détective Conan -" une fois le suffixe "Tome 14" retiré -
        // le tiret résiduel empêchait ensuite tout match de préfixe côté
        // recherche de tomes (66 résultats sans lui, 2 seulement avec).
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
        // Cas réel observé (voir historique) : Google Books indexe le tome
        // scanné ("Fragments d'elles T04"), pas la série - on ne veut que le
        // titre de la série pour pré-remplir l'ajout.
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
    void skips_a_known_related_series_and_falls_through_to_the_next_result() throws Exception {
        // Même biais de popularité que côté Open Library (voir
        // OpenLibraryFrenchTitleProviderTest, "Dragon Ball Super nº 18" pour
        // une recherche "Dragon Ball") - possible aussi ici en repli.
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
