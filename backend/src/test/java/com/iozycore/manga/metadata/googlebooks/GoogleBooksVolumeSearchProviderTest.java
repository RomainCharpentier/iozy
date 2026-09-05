package com.iozycore.manga.metadata.googlebooks;

import com.iozycore.manga.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksVolumeSearchProviderTest {

    @Test
    void excludes_a_result_whose_listed_author_shares_no_word_with_the_expected_author() throws Exception {
        // Cas réel trouvé en continuant les tests sur "Monster" (voir
        // historique) : "Monster Allergy Next Gen" (BD italienne) et
        // "Monster Délices" (manga culinaire) commencent tous deux
        // littéralement par "Monster " - un simple préfixe exact ne suffit
        // pas à confirmer qu'il s'agit du "Monster" de Naoki Urasawa quand
        // Google Books liste un auteur SANS AUCUN rapport.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Monster - Tome 1", "language": "fr", "publisher": "Kana",
                        "authors": ["Naoki Urasawa"] } },
                    { "volumeInfo": { "title": "Monster Allergy Next Gen - Tome 2", "language": "fr",
                        "authors": ["Francesco Artibani", "Alessandro Barbucci"] } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Monster", List.of(), "Naoki Urasawa");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Monster - Tome 1");
    }

    @Test
    void keeps_a_result_with_no_author_listed_even_when_the_expected_author_is_known() throws Exception {
        // La plupart des fiches françaises n'ont pas le champ auteur
        // correctement renseigné (vérifié manuellement, voir historique) -
        // l'absence d'auteur ne doit jamais exclure un résultat par ailleurs
        // valide, contrairement à un mismatch EXPLICITE ci-dessus.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Monster - Tome 1", "language": "fr", "publisher": "Kana" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Monster", List.of(), "Naoki Urasawa");

        assertThat(result).hasSize(1);
    }

    @Test
    void extracts_a_bare_zero_padded_volume_number_without_a_tome_keyword() throws Exception {
        // Cas réel observé (voir historique) : l'édition française "Sword
        // Art Online" (Ofelbe) numérote ses tomes SANS mot-clé "Tome"/"T."
        // ni "Vol." - juste un numéro à zéro de tête collé au titre de
        // série, avant le nom de l'arc ("Aincrad") - sans ce repli, la série
        // entière ne remontait AUCUN résultat (rejetée comme un coffret sans
        // numéro exploitable).
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Sword Art Online 001 Aincrad", "language": "fr", "publisher": "Ofelbe" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Sword Art Online");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(1);
        assertThat(result.get(0).edition()).isEqualTo("Aincrad");
    }

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
    void falls_back_to_edition_inconnue_when_the_publisher_field_is_corrupted() throws Exception {
        // Cas réel observé (voir historique) : le endpoint de RECHERCHE
        // Google Books ("/volumes?q=...") renvoie "12-21" comme "publisher"
        // pour plusieurs tomes distincts de "Vinland Saga", alors que le
        // endpoint de LECTURE PAR IDENTIFIANT ("/volumes/{id}") renvoie
        // pourtant "UNIVERS POCHE" pour ces mêmes identifiants - un vrai
        // éditeur contient toujours au moins une lettre, contrairement à
        // cette valeur numérique visiblement corrompue côté Google.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Vinland Saga - tome 5", "language": "fr", "publisher": "12-21" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Vinland Saga");

        assertThat(result.get(0).edition()).isEqualTo("Édition inconnue");
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
    void treats_a_bare_series_title_with_no_volume_number_at_all_as_a_one_shot() throws Exception {
        // Cas réel observé (voir historique) : "Re/member" et "Hideout" sont
        // des one-shots (manga complets en un seul tome) - leur titre brut
        // EST exactement le titre de la série, sans "Tome N" nulle part
        // (contrairement à "Death Note Complete Box Set" ci-dessus, qui n'a
        // pas de numéro non plus mais laisse du texte descriptif après le
        // titre de série - un vrai coffret, pas un one-shot). Sans ce repli,
        // ces mangas étaient invisibles à la recherche de tomes.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Hideout", "language": "fr", "publisher": "Editions Ki-oon" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Hideout");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).volumeNumber()).isEqualTo(1);
        assertThat(result.get(0).edition()).isEqualTo("Editions Ki-oon");
    }

    @Test
    void does_not_promote_a_bare_title_mention_to_tome_one_when_real_numbered_tomes_also_exist() throws Exception {
        // Un titre nu MÉLANGÉ à de vrais tomes numérotés indique une vraie
        // série multi-tomes mal couverte par une fiche incomplète (ex: une
        // republication du tome déjà listé plus loin sans son numéro) - le
        // titre nu est alors du bruit à écarter, jamais un one-shot à
        // promouvoir en "Tome 1" (qui existe déjà légitimement par ailleurs).
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Some Series", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "Some Series - Tome 1", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "Some Series - Tome 2", "language": "fr", "publisher": "Kana" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Some Series");

        assertThat(result).extracting(VolumeCandidate::volumeNumber).containsExactly(1, 2);
    }

    @Test
    void keeps_several_editions_that_each_have_only_one_volume_when_none_is_solidly_represented() {
        // Cas réel observé sur "Sword Art Online" (voir historique) : les
        // arcs "Aincrad", "Progressive" et "Ordinal Scale" ne ressortent
        // chacun qu'avec UN SEUL tome trouvé (limite de couverture Google
        // Books, pas un faux positif) - sans cet assouplissement, les TROIS
        // étaient écartés comme du bruit (countByEdition.size() > 1), la
        // série entière ne remontant plus AUCUN résultat. filterOutNoiseEditions
        // testée directement (package-private) : parse() ne représente
        // qu'une seule requête/mot-clé, ce filtre n'agit qu'après fusion de
        // TOUTES les requêtes (voir runKeywordSearches).
        List<VolumeCandidate> candidates = List.of(
                new VolumeCandidate("Aincrad", 1, null, "Sword Art Online 001 Aincrad"),
                new VolumeCandidate("Progressive", 2, null, "Sword Art Online Progressive Tome 2"),
                new VolumeCandidate("Ordinal Scale", 4, null, "Sword Art Online - Ordinal Scale Tome 4"));

        List<VolumeCandidate> result = GoogleBooksVolumeSearchProvider.filterOutNoiseEditions(candidates);

        assertThat(result).extracting(VolumeCandidate::edition).containsExactlyInAnyOrder("Aincrad", "Progressive", "Ordinal Scale");
    }

    @Test
    void still_discards_a_single_volume_edition_when_another_edition_is_solidly_represented() {
        // Contrairement au cas ci-dessus : ici "Kana" est solidement
        // représentée (3 tomes) - "Party" (1 seul tome) ressort alors bien
        // comme un faux positif isolé à écarter, comportement inchangé.
        List<VolumeCandidate> candidates = List.of(
                new VolumeCandidate("Kana", 1, null, "One Piece - Tome 1"),
                new VolumeCandidate("Kana", 2, null, "One Piece - Tome 2"),
                new VolumeCandidate("Kana", 3, null, "One Piece - Tome 3"),
                new VolumeCandidate("Party", 1, null, "One Piece Party - Tome 1"));

        List<VolumeCandidate> result = GoogleBooksVolumeSearchProvider.filterOutNoiseEditions(candidates);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Kana");
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
