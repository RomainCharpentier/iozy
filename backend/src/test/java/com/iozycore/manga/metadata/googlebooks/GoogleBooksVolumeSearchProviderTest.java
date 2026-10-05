package com.iozycore.manga.metadata.googlebooks;

import com.iozycore.manga.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksVolumeSearchProviderTest {

    // ------------------------------------ An edition searched by its name (batch 144)

    @Test
    void searchEdition_reads_the_pages_one_after_the_other_and_stops_at_the_first_empty_one() {
        // "One Piece Édition originale": 300 records announced, one French
        // volume out of two in the first page (measured on 2026-09-06) -
        // a single page left the edition at 30 volumes out of 66.
        List<String> urls = new java.util.ArrayList<>();
        GoogleBooksHttpClient client = new GoogleBooksHttpClient("", "") {
            @Override
            public String get(String url) {
                urls.add(url);
                if (url.contains("startIndex=0")) {
                    return page("One Piece - Édition originale - Tome 24", "9782331015946");
                }
                if (url.contains("startIndex=40")) {
                    return page("One Piece - Édition originale - Tome 45", "9782331026010");
                }
                return "{ \"totalItems\": 300 }";
            }

            @Override
            public boolean isQuotaLikelyExhausted() {
                return false;
            }
        };
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider(client);

        List<VolumeCandidate> result = provider.searchEdition("One Piece", "Eiichiro Oda", "Édition originale", List.of());

        assertThat(result).extracting(VolumeCandidate::volumeNumber).containsExactly(24, 45);
        assertThat(urls).hasSize(3); // two full pages, then the first empty page stops the reading
        assertThat(urls.get(0)).contains("intitle%3AOne+Piece+%C3%89dition+originale");
    }

    private static String page(String titre, String isbn) {
        return """
                { "items": [ { "volumeInfo": { "title": "%s", "language": "fr", "publisher": "Glénat Manga",
                    "industryIdentifiers": [ { "type": "ISBN_13", "identifier": "%s" } ] } } ] }
                """.formatted(titre, isbn);
    }

    @Test
    void excludes_a_result_whose_listed_author_shares_no_word_with_the_expected_author() throws Exception {
        // Real case found while continuing the tests on "Monster" (see
        // history): "Monster Allergy Next Gen" (Italian comic) and
        // "Monster Délices" (culinary manga) both start
        // literally with "Monster " - a simple exact prefix is not enough
        // to confirm it is the "Monster" by Naoki Urasawa when
        // Google Books lists an author with NO connection.
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
    void reads_the_publication_date_at_the_precision_google_books_gives_it() throws Exception {
        // The releases calendar (batch 146) reads the day when the record
        // carries it - a pre-order too -, the month or the year otherwise, and nothing
        // of an unexpected form. The year alone stays in `annee`, which is used to
        // name an edition.
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Naruto - Tome 72", "language": "fr", "publisher": "Kana", "publishedDate": "2026-10-14" } },
                    { "volumeInfo": { "title": "Naruto - Tome 73", "language": "fr", "publisher": "Kana", "publishedDate": "2026-12" } },
                    { "volumeInfo": { "title": "Naruto - Tome 74", "language": "fr", "publisher": "Kana", "publishedDate": "2027" } },
                    { "volumeInfo": { "title": "Naruto - Tome 75", "language": "fr", "publisher": "Kana", "publishedDate": "bientôt" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Naruto", List.of(), null);

        assertThat(result).extracting(VolumeCandidate::releaseDate).containsExactly("2026-10-14", "2026-12", "2027", null);
        assertThat(result).extracting(VolumeCandidate::annee).containsExactly(2026, 2026, 2027, null);
    }

    @Test
    void keeps_a_result_with_no_author_listed_even_when_the_expected_author_is_known() throws Exception {
        // Most French records do not have the author field
        // properly filled in (checked manually, see history) -
        // the absence of an author must never exclude an otherwise valid
        // result, unlike an EXPLICIT mismatch above.
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
        // Real case observed (see history): the French edition "Sword
        // Art Online" (Ofelbe) numbers its volumes WITHOUT the keyword "Tome"/"T."
        // or "Vol." - just a zero-padded number stuck to the series
        // title, before the arc name ("Aincrad") - without this fallback, the whole
        // series returned NO result (rejected as a box set without a
        // usable number).
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
        // Real case observed (see history): the official French title is
        // indexed "ONE-PUNCH MAN" (dash) while the known series title
        // (MyAnimeList) is "One Punch Man" (space) - a simple startsWith
        // made ALL the volumes of this very well known manga invisible.
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
        // Real case observed (see history): the official French title is
        // indexed "Haikyu !! - Les As du volley T10" (space before "!!")
        // while the known series title (MyAnimeList) is "Haikyu!!"
        // (no space) - same limit as the "One Punch Man" case above.
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
        // Real case observed (see history): "Yu-Gi-Oh ! (Intégrale) -
        // Tome 1" has its collection name in parentheses - without cleaning
        // the parentheses, the extracted edition stayed "(Intégrale)".
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
        // Real case observed (see history): "City Hunter (Nicky Larson)
        // Tome 1 . Edition de luxe" follows the title with a historical
        // alias in parentheses ("Nicky Larson", name of the French
        // adaptation of City Hunter) BEFORE the volume number - without
        // telling it apart from a real edition name in parentheses (see the
        // previous test), the extracted edition stayed "Nicky Larson) . Edition De
        // Luxe" (orphan closing parenthesis mixed with the real edition name).
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
        // Real case observed (see history): the title only contains the
        // series + the volume number, nothing to isolate as a collection name.
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
        assertThat(result.get(0).edition()).isEqualTo("Kana"); // fallback on the publisher
        assertThat(result.get(0).imageUrl()).isEqualTo("https://books.google.com/tome3.jpg"); // forced to https
    }

    @Test
    void extracts_the_abbreviated_t_zero_prefixed_volume_number_format() throws Exception {
        // Real case observed (see history): Google Books sometimes indexes the
        // volume in the abbreviated form "T04" (no dot, zero-padded) rather
        // than "Tome 4" - e.g. "Fragments d'elles T04" (Nao Emoto / Mag Hsu, Pika).
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
        assertThat(result.get(0).edition()).isEqualTo("Pika"); // fallback on the publisher, no collection name
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

        assertThat(result.get(0).edition()).isEqualTo("Édition Originale"); // capitalised word by word
        assertThat(result.get(0).volumeNumber()).isEqualTo(60);
    }

    @Test
    void strips_a_leading_period_left_over_when_the_volume_number_appears_before_the_collection_name() throws Exception {
        // Real case observed (see history): "Chainsaw Man Tome 18 .
        // Edition collector" places the volume number BEFORE the name of the
        // collection, separated by a dot - without cleaning the dot,
        // the extracted edition stayed ". Edition collector".
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
        // Real case observed (see history): "Demon Slayer" comes out both
        // with publisher="Panini" (e.g. "Demon Slayer T01") and
        // publisher="Panini Manga" (e.g. "Demon Slayer Tome 11") for the SAME
        // real publisher - without normalisation, that formed two edition
        // tabs ("Panini" and "Panini Manga") instead of one.
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
        // Real case observed (see history): "Kingdom - Tome 70 - Kingdom"
        // repeats the series title AFTER the volume number on some
        // Google Books records - once the prefix and the number are removed, only
        // this duplicate is left, which would otherwise look like a real
        // collection name called "Kingdom" (identical to the series, so with no
        // informative value).
        GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();
        String body = """
                {
                  "items": [
                    { "volumeInfo": { "title": "Kingdom - Tome 70 - Kingdom", "language": "fr", "publisher": "Meian" } }
                  ]
                }
                """;

        List<VolumeCandidate> result = provider.parse(body, "Kingdom");

        assertThat(result.get(0).edition()).isEqualTo("Meian"); // fallback on the publisher, not "Kingdom"
    }

    @Test
    void falls_back_to_edition_inconnue_when_the_publisher_field_is_corrupted() throws Exception {
        // Real case observed (see history): the Google Books SEARCH
        // endpoint ("/volumes?q=...") returns "12-21" as "publisher"
        // for several distinct volumes of "Vinland Saga", while the
        // READ BY IDENTIFIER endpoint ("/volumes/{id}") returns
        // "UNIVERS POCHE" for these same identifiers - a real
        // publisher always contains at least one letter, unlike
        // this numeric value visibly corrupted on Google's side.
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
        // Real case observed (see history): "L'Attaque des Titans -
        // L'intégrale T01 à T04" (box set of 4 volumes) contains TWO volume
        // numbers ("T01" and "T04") linked by "à" - once the two numbers are
        // removed, "à" stays alone in the middle of the remaining text and ends up
        // capitalised as "À" ("L'intégrale À" instead of "L'intégrale").
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
        // Real case observed (see history): Google Books indexes the same
        // collection "My Hero Academia Team-Up Mission" in three different
        // forms depending on the volume ("Team Up Mission" without a dash, "Team-Up
        // Mission" and "Team-up Mission" with a dash and different case) - without
        // normalisation, that formed three nearly identical edition tabs
        // instead of one.
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
        // Real case observed (see history): searching "Naruto" returns
        // volumes of "Boruto - Naruto Next Generations", a distinct spin-off,
        // not an edition of Naruto.
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
        // Real case observed (see history): searching "Tokyo Ghoul" returns
        // volumes of "Tokyo Ghoul:re" (the sequel, a separate series on
        // MyAnimeList) - ":re" is stuck on with no space, unlike a real
        // collection name ("One Piece - Édition originale"...), always
        // separated from the series title by a space.
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
        // Real case observed (see history): "Blue Lock - Episode Nagi -
        // Tome 5" does start with "Blue Lock" and respects the separation
        // by space (unlike the Tokyo Ghoul:re case above) - so
        // structurally indistinguishable from a real collection name, unless
        // we know from an external source (see RelatedSeriesService, derived
        // from the MyAnimeList relations) that "Episode Nagi" designates a spin-off.
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

        assertThat(result).hasSize(1); // only the real Blue Lock edition remains
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
        // Real case observed (see history): "Re/member" and "Hideout" are
        // one-shots (complete manga in a single volume) - their raw title
        // IS exactly the series title, with no "Tome N" anywhere
        // (unlike "Death Note Complete Box Set" above, which has
        // no number either but leaves descriptive text after the
        // series title - a real box set, not a one-shot). Without this fallback,
        // these manga were invisible to the volume search.
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
        // A bare title MIXED with real numbered volumes indicates a real
        // multi-volume series poorly covered by an incomplete record (e.g. a
        // republication of the volume already listed further on without its number) - the
        // bare title is then noise to discard, never a one-shot to
        // promote to "Tome 1" (which already legitimately exists elsewhere).
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
        // Real case observed on "Sword Art Online" (see history): the
        // arcs "Aincrad", "Progressive" and "Ordinal Scale" each only come out
        // with ONE SINGLE volume found (Google Books coverage limit,
        // not a false positive) - without this relaxation, ALL THREE
        // were discarded as noise (countByEdition.size() > 1), the
        // whole series returning NO result. filterOutNoiseEditions is
        // tested directly (package-private): parse() only represents
        // a single request/keyword, this filter only acts after merging
        // ALL the requests (see runKeywordSearches).
        List<VolumeCandidate> candidates = List.of(
                new VolumeCandidate("Aincrad", 1, null, "Sword Art Online 001 Aincrad"),
                new VolumeCandidate("Progressive", 2, null, "Sword Art Online Progressive Tome 2"),
                new VolumeCandidate("Ordinal Scale", 4, null, "Sword Art Online - Ordinal Scale Tome 4"));

        List<VolumeCandidate> result = GoogleBooksVolumeSearchProvider.filterOutNoiseEditions(candidates);

        assertThat(result).extracting(VolumeCandidate::edition).containsExactlyInAnyOrder("Aincrad", "Progressive", "Ordinal Scale");
    }

    @Test
    void still_discards_a_single_volume_edition_when_another_edition_is_solidly_represented() {
        // Unlike the case above: here "Kana" is solidly
        // represented (3 volumes) - "Party" (1 single volume) then does come out
        // as an isolated false positive to discard, unchanged behaviour.
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
