package com.iozycore.metadata.googlebooks;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksFrenchTitleProviderTest {

    @Test
    void treats_a_single_word_author_as_too_generic_for_the_author_only_fallback() {
        // Cas réel trouvé en continuant les tests sur "Akame ga Kill" (voir
        // historique) : inauthor:"Takahiro" (mononyme, pseudonyme du
        // scénariste) matchait aussi "Takahiro Arai", illustrateur d'une
        // adaptation des Misérables - une personne différente sans aucun
        // rapport.
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
    void prefers_a_tome_numbered_result_over_an_unrelated_homonym_from_the_same_author() throws Exception {
        // Cas réel trouvé en continuant les tests sur "Witch Hat Atelier"
        // (voir historique) : le repli "auteur seul" (voir findFrenchTitle)
        // remonte en PREMIER "L'Art des Sorciers", un ARTBOOK sans rapport
        // du même auteur (Kamome Shirahama), avant "L'Atelier des Sorciers
        // T15" (le vrai manga, correctement numéroté) un peu plus loin dans
        // les mêmes résultats - un numéro de tome extrait est un signal
        // bien plus fort qu'une simple première position.
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
        // Cas réel trouvé en continuant les tests sur "Delicious in Dungeon"
        // (voir historique) : "Gloutons et Dragons (Tome 12)" est le vrai
        // titre français, mais le numéro PARENTHÉSÉ n'était pas reconnu par
        // VOLUME_SUFFIX - le repli "auteur seul" retombait alors sur "Les
        // Sept Rejetons du dragon", un autre livre du même auteur SANS
        // numéro de tome, qui semblait alors "préférable" à tort.
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
        // Dernier recours "auteur seul" (inauthor:) : vérifié en direct sur
        // inauthor:"Ryoko Kui" - "Les Sept Rejetons du dragon" ET "Gloutons
        // et Dragons : guide officiel" arrivent AVANT "Gloutons et Dragons
        // (Tome 12)". Sans numéro de tome, un résultat de cette étape n'est
        // rattaché à la série cherchée par strictement rien.
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
        // Contrairement au cas ci-dessus : si AUCUN résultat n'a de numéro
        // de tome (ex: un vrai one-shot sans jamais de fiche "Tome 1"
        // indexée), le comportement reste inchangé - premier résultat
        // retenu tel quel plutôt que de tout écarter.
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
