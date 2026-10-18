package com.iozycore.manga.metadata.googlebooks;

import com.iozycore.manga.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/**
 * Unlike {@link GoogleBooksVolumeSearchProviderTest} (one response =
 * one keyword = one test), this class replays the COMPLETE pipeline of
 * {@code searchVolumes}: several simulated responses (one per keyword,
 * like {@code QUICK_EDITION_KEYWORDS}) merged through
 * {@link GoogleBooksVolumeSearchProvider#mergeAndFinalize} - deduplication
 * THEN one-shot resolution THEN anti-noise filter, in this exact order.
 * <p>
 * Reason for existing (see the conversation history): each bug fixed
 * this session had its own unit proof, but the "Sword Art
 * Online" bug (numbering without keyword AND anti-noise filter too strict)
 * was only visible through the INTERACTION of the two, invisible when testing
 * each step in isolation - this class freezes these interactions already
 * seen in production so that a future local fix does not
 * silently break them again from a distance.
 */
class GoogleBooksVolumeSearchProviderRegressionTest {

    private final GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();

    /** Simulates {@code runKeywordSearches}: one response per keyword, combined
     * before merging - never {@code parse()} (a single response, skips
     * {@code filterOutNoiseEditions}, see its javadoc). */
    private List<VolumeCandidate> searchAcrossKeywords(String seriesTitle, List<String> excludedTitleFragments, String... bodies) throws Exception {
        List<VolumeCandidate> combined = new ArrayList<>();
        for (String body : bodies) {
            combined.addAll(provider.extractCandidates(body, seriesTitle, excludedTitleFragments, null));
        }
        return GoogleBooksVolumeSearchProvider.mergeAndFinalize(combined);
    }

    @Test
    void sword_art_online_keeps_three_sparsely_covered_arcs_numbered_without_a_tome_keyword() throws Exception {
        // Reproduces the full real case (see history): 3 different keywords
        // each return ONE SINGLE volume, spread over 3 distinct arcs
        // ("Aincrad" stuck on with no keyword, "Progressive" and
        // "Ordinal Scale" with "Tome N") - without the bare numbering fallback
        // NOR the relaxing of the anti-noise filter, this test failed
        // (empty result).
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Sword Art Online 001 Aincrad", "language": "fr", "publisher": "Ofelbe" } }
                ] }
                """;
        String perfectEditionKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Sword Art Online Progressive Tome 2", "language": "fr" } },
                    { "volumeInfo": { "title": "Sword Art Online - Ordinal Scale Tome 4", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("Sword Art Online", List.of(), blankKeyword, perfectEditionKeyword);

        assertThat(result).extracting(VolumeCandidate::edition, VolumeCandidate::volumeNumber)
                .containsExactlyInAnyOrder(tuple("Aincrad", 1), tuple("Progressive", 2), tuple("Ordinal Scale", 4));
    }

    @Test
    void one_piece_discards_a_single_hit_spin_off_while_deduping_the_solidly_represented_edition_across_keywords() throws Exception {
        // "Kana" appears in TWO different keywords for the same volume 1
        // (once without a cover, once with) - must merge into ONE
        // entry WITH a cover (see dedupeAndSort), while "One Piece
        // Party" (a single volume, false positive of the full-text search)
        // must be discarded since "Kana" is solidly represented (3+
        // volumes, see filterOutNoiseEditions).
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "One Piece - Tome 1", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "One Piece - Tome 2", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "One Piece - Tome 3", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "One Piece Party - Tome 1", "language": "fr" } }
                ] }
                """;
        String editionOriginaleKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "One Piece - Tome 1", "language": "fr", "publisher": "Kana",
                        "imageLinks": { "thumbnail": "http://books.google.com/op1.jpg" } } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("One Piece", List.of(), blankKeyword, editionOriginaleKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Kana");
        assertThat(result).hasSize(3);
        VolumeCandidate tome1 = result.stream().filter(c -> c.volumeNumber() == 1).findFirst().orElseThrow();
        assertThat(tome1.imageUrl()).isEqualTo("https://books.google.com/op1.jpg");
    }

    @Test
    void dragon_ball_excludes_sd_and_super_regardless_of_which_keyword_surfaces_them_while_merging_perfect_edition() throws Exception {
        // "SD" and "Super" (known spin-off/sequel, see RelatedSeriesService)
        // come out on DIFFERENT keywords from "Perfect Edition" - the
        // deep search must exclude ONLY the known fragments,
        // never touch the legitimate volumes found elsewhere, even
        // when combined from several keywords.
        List<String> excludedTitleFragments = List.of("Dragon Ball SD", "Dragon Ball Super");
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Dragon Ball SD - Tome 01", "language": "fr",
                        "imageLinks": { "thumbnail": "http://books.google.com/sd1.jpg" } } },
                    { "volumeInfo": { "title": "Dragon Ball Super nº 18", "language": "fr" } },
                    { "volumeInfo": { "title": "Dragon Ball perfect edition - Tome 01", "language": "fr" } }
                ] }
                """;
        String perfectEditionKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Dragon Ball perfect edition - Tome 02", "language": "fr" } },
                    { "volumeInfo": { "title": "Dragon Ball perfect edition - Tome 03", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("Dragon Ball", excludedTitleFragments, blankKeyword, perfectEditionKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Perfect Edition");
        assertThat(result).extracting(VolumeCandidate::volumeNumber).containsExactlyInAnyOrder(1, 2, 3);
    }

    @Test
    void fairy_tail_excludes_100_years_quest_sequel_across_keywords() throws Exception {
        // "100 Years Quest" (tagged "sequel" on MyAnimeList, see history)
        // comes out on SEVERAL keywords at once - must stay excluded whichever
        // one finds it, without affecting "L'intégrale".
        List<String> excludedTitleFragments = List.of("100 Years Quest");
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Fairy Tail - 100 years quest Tome 5", "language": "fr" } },
                    { "volumeInfo": { "title": "Fairy Tail L'intégrale Tome 1", "language": "fr" } },
                    { "volumeInfo": { "title": "Fairy Tail L'intégrale Tome 2", "language": "fr" } }
                ] }
                """;
        String editionOriginaleKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Fairy Tail - 100 years quest Tome 6", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("Fairy Tail", excludedTitleFragments, blankKeyword, editionOriginaleKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("L'intégrale");
    }

    @Test
    void city_hunter_excludes_the_historical_alias_while_keeping_the_real_integrale_across_keywords() throws Exception {
        // "(Nicky Larson)" is a historical alias stuck to the series title
        // (see skipLeadingAliasNotResemblingAnEdition), never an edition
        // name - must stay invisible even mixed with a real
        // edition found on ANOTHER keyword.
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "City Hunter (Nicky Larson) - Tome 1", "language": "fr", "publisher": "Panini Manga" } },
                    { "volumeInfo": { "title": "City Hunter (Nicky Larson) - Tome 2", "language": "fr", "publisher": "Panini Manga" } }
                ] }
                """;
        String integraleKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "City Hunter (Intégrale) - Tome 1", "language": "fr" } },
                    { "volumeInfo": { "title": "City Hunter (Intégrale) - Tome 2", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("City Hunter", List.of(), blankKeyword, integraleKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Panini", "Intégrale");
    }
}
