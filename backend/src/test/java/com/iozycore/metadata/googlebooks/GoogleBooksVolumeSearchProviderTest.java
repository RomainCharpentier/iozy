package com.iozycore.metadata.googlebooks;

import com.iozycore.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksVolumeSearchProviderTest {

    @Test
    void matches_the_series_prefix_even_when_google_books_uses_a_hyphen_where_the_series_title_has_a_space() throws Exception {
        // Cas réel observé (voir historique) : le titre officiel français est
        // indexé "ONE-PUNCH MAN" (tiret) alors que le titre de série connu
        // (MyAnimeList) est "One Punch Man" (espace) - un simple startsWith
        // rendait TOUS les tomes de ce manga très connu invisibles.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "ONE-PUNCH MAN - tome 18", "language": "fr", "publisher": "Kurokawa" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "One Punch Man");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(18);
        assertThat(result.get(0).edition()).isEqualTo("Kurokawa");
    }

    @Test
    void matches_the_series_prefix_even_when_google_books_inserts_a_space_the_series_title_does_not_have() throws Exception {
        // Cas réel observé (voir historique) : le titre officiel français est
        // indexé "Haikyu !! - Les As du volley T10" (espace avant "!!")
        // alors que le titre de série connu (MyAnimeList) est "Haikyu!!"
        // (aucun espace) - même limite que le cas "One Punch Man" ci-dessus.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Haikyu !! - Les As du volley T10", "language": "fr", "publisher": "Crunchyroll" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Haikyu!!");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(10);
        assertThat(result.get(0).edition()).isEqualTo("Les As Du Volley");
    }

    @Test
    void strips_parentheses_left_over_around_a_collection_name() throws Exception {
        // Cas réel observé (voir historique) : "Yu-Gi-Oh ! (Intégrale) -
        // Tome 1" a son nom de collection entre parenthèses - sans nettoyage
        // des parenthèses, l'édition extraite restait "(Intégrale)".
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Yu-Gi-Oh ! (Intégrale) - Tome 1", "language": "fr", "publisher": "Kana" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Yu-Gi-Oh!");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(1);
        assertThat(result.get(0).edition()).isEqualTo("Intégrale");
    }

    @Test
    void strips_a_historical_alias_in_parentheses_stuck_to_the_series_title_before_the_volume_number() throws Exception {
        // Cas réel observé (voir historique) : "City Hunter (Nicky Larson)
        // Tome 1 . Edition de luxe" fait suivre le titre d'un alias
        // historique entre parenthèses ("Nicky Larson", nom de l'adaptation
        // française de City Hunter) AVANT le numéro de tome - sans le
        // distinguer d'un vrai nom d'édition entre parenthèses (voir le test
        // précédent), l'édition extraite restait "Nicky Larson) . Edition De
        // Luxe" (parenthèse fermante orpheline mélangée au vrai nom d'édition).
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "City Hunter (Nicky Larson) Tome 1 . Edition de luxe", "language": "fr", "publisher": "Panini" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "City Hunter");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(1);
        assertThat(result.get(0).edition()).isEqualTo("Edition De Luxe");
    }

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
    void extracts_the_abbreviated_t_zero_prefixed_volume_number_format() throws Exception {
        // Cas réel observé (voir historique) : Google Books indexe parfois le
        // tome sous la forme abrégée "T04" (sans point, zéro de tête) plutôt
        // que "Tome 4" - ex: "Fragments d'elles T04" (Nao Emoto / Mag Hsu, Pika).
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Fragments d'elles T04", "language": "fr", "publisher": "Pika" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Fragments d'elles");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(4);
        assertThat(result.get(0).edition()).isEqualTo("Pika"); // repli sur l'éditeur, pas de nom de collection
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

        assertThat(result.get(0).edition()).isEqualTo("Édition Originale"); // capitalisé mot par mot
        assertThat(result.get(0).volumeNumber()).isEqualTo(60);
    }

    @Test
    void strips_a_leading_period_left_over_when_the_volume_number_appears_before_the_collection_name() throws Exception {
        // Cas réel observé (voir historique) : "Chainsaw Man Tome 18 .
        // Edition collector" place le numéro de tome AVANT le nom de
        // collection, séparé par un point - sans nettoyage du point,
        // l'édition extraite restait ". Edition collector".
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Chainsaw Man Tome 18 . Edition collector", "language": "fr", "publisher": "Crunchyroll" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Chainsaw Man");

        assertThat(result.get(0).edition()).isEqualTo("Edition Collector");
        assertThat(result.get(0).volumeNumber()).isEqualTo(18);
    }

    @Test
    void treats_a_publisher_name_with_a_trailing_manga_suffix_the_same_as_without_it() throws Exception {
        // Cas réel observé (voir historique) : "Demon Slayer" ressort à la
        // fois avec publisher="Panini" (ex: "Demon Slayer T01") et
        // publisher="Panini Manga" (ex: "Demon Slayer Tome 11") pour le MÊME
        // éditeur réel - sans normalisation, ça formait deux onglets
        // d'édition ("Panini" et "Panini Manga") au lieu d'un seul.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Demon Slayer T01", "language": "fr", "publisher": "Panini" } },
                    { "volumeInfo": { "title": "Demon Slayer Tome 11", "language": "fr", "publisher": "Panini Manga" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Demon Slayer");

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Panini");
    }

    @Test
    void falls_back_to_the_publisher_when_the_extracted_collection_name_just_repeats_the_series_title() throws Exception {
        // Cas réel observé (voir historique) : "Kingdom - Tome 70 - Kingdom"
        // répète le titre de la série APRÈS le numéro de tome sur certaines
        // fiches Google Books - une fois le préfixe et le numéro retirés, il
        // ne reste que ce doublon, qui ressemblerait sinon à un vrai nom de
        // collection appelé "Kingdom" (identique à la série, donc sans
        // valeur informative).
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Kingdom - Tome 70 - Kingdom", "language": "fr", "publisher": "Meian" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Kingdom");

        assertThat(result.get(0).edition()).isEqualTo("Meian"); // repli sur l'éditeur, pas "Kingdom"
    }

    @Test
    void strips_the_dangling_range_connector_left_over_by_a_multi_volume_omnibus_title() throws Exception {
        // Cas réel observé (voir historique) : "L'Attaque des Titans -
        // L'intégrale T01 à T04" (coffret de 4 tomes) contient DEUX numéros
        // de tome ("T01" et "T04") reliés par "à" - une fois les deux numéros
        // retirés, "à" reste seul au milieu du texte restant et se retrouve
        // capitalisé en "À" ("L'intégrale À" au lieu de "L'intégrale").
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "L'Attaque des Titans - L'intégrale T01 à T04", "language": "fr", "publisher": "Pika" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "L'Attaque des Titans");

        assertThat(result.get(0).edition()).isEqualTo("L'intégrale");
        assertThat(result.get(0).volumeNumber()).isEqualTo(1);
    }

    @Test
    void treats_an_internal_hyphen_in_the_collection_name_as_a_space_so_variants_share_one_edition() throws Exception {
        // Cas réel observé (voir historique) : Google Books indexe la même
        // collection "My Hero Academia Team-Up Mission" sous trois formes
        // différentes selon le tome ("Team Up Mission" sans tiret, "Team-Up
        // Mission" et "Team-up Mission" avec tiret et casse différente) - sans
        // normalisation, ça formait trois onglets d'édition quasi identiques
        // au lieu d'un seul.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "My Hero Academia Team Up Mission T06", "language": "fr", "publisher": "Ki-oon" } },
                    { "volumeInfo": { "title": "My Hero Academia Team-Up Mission Tome 7", "language": "fr", "publisher": "Ki-oon" } },
                    { "volumeInfo": { "title": "My Hero Academia Team-up Mission T02 - Tome 2", "language": "fr", "publisher": "Ki-oon" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "My Hero Academia");

        assertThat(result).extracting(VolumeCandidate::edition)
                .containsOnly("Team Up Mission");
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
    void excludes_a_different_spin_off_series_that_merely_mentions_the_searched_title() throws Exception {
        // Cas réel observé (voir historique) : chercher "Naruto" remonte des
        // tomes de "Boruto - Naruto Next Generations", un spin-off distinct,
        // pas une édition de Naruto.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Boruto - Naruto Next Generations - Tome 3", "language": "fr", "publisher": "Kana" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Naruto");

        assertThat(result).isEmpty();
    }

    @Test
    void excludes_a_sequel_series_glued_to_the_searched_title_with_no_separating_space() throws Exception {
        // Cas réel observé (voir historique) : chercher "Tokyo Ghoul" remonte
        // des tomes de "Tokyo Ghoul:re" (la suite, une série à part sur
        // MyAnimeList) - ":re" est collé sans espace, contrairement à un vrai
        // nom de collection ("One Piece - Édition originale"...), toujours
        // séparé du titre de la série par un espace.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Tokyo Ghoul:re Tome 5", "language": "fr", "publisher": "Glénat Manga" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Tokyo Ghoul");

        assertThat(result).isEmpty();
    }

    @Test
    void excludes_a_known_spin_off_series_flagged_via_related_series_fragments() throws Exception {
        // Cas réel observé (voir historique) : "Blue Lock - Episode Nagi -
        // Tome 5" commence bien par "Blue Lock" et respecte la séparation
        // par espace (contrairement au cas Tokyo Ghoul:re ci-dessus) - donc
        // structurellement indiscernable d'un vrai nom de collection, sauf à
        // savoir par une source externe (voir RelatedSeriesService, dérivé
        // des relations MyAnimeList) que "Episode Nagi" désigne un spin-off.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Blue Lock - Episode Nagi - Tome 5", "language": "fr", "publisher": "Pika" } },
                    { "volumeInfo": { "title": "Blue Lock - Tome 5", "language": "fr", "publisher": "Pika" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Blue Lock", List.of("Episode Nagi"));

        assertThat(result).hasSize(1); // seule la vraie édition de Blue Lock reste
        assertThat(result.get(0).edition()).isEqualTo("Pika");
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
