package com.iozycore.manga.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.manga.metadata.FrenchTitleMatch;
import com.iozycore.manga.metadata.FrenchTitleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Best-effort search of a French edition title via the general
 * search API of Open Library (already used for the ISBN scan, see
 * OpenLibraryBarcodeProvider - no key required, no aggressive quota
 * unlike Google Books). Tried first (@Order(1)) in
 * FrenchTitleService.findFrenchTitle, Google Books staying as a fallback.
 * <p>
 * Cascade strategy, checked manually before writing this code (see
 * history of the conversation):
 * <ol>
 *   <li>author + full title - works when the French edition keeps the
 *       title as is (e.g. "My Hero Academia", never translated);</li>
 *   <li>author + a distinctive word of the title, one by one - a proper noun
 *       (character, place...) often survives translation alone when the
 *       whole title matches nothing: searching "Hajime Isayama Attack on
 *       Titan" finds NOTHING (the French title never contains "Attack
 *       on"), but "Hajime Isayama Titan" directly finds "L'Attaque
 *       des Titans" - Open Library seems to require all the terms of the
 *       query to appear somewhere, so the longer the phrase is,
 *       the less chance it has to match a translation;</li>
 *   <li>author alone - last resort, returned as {@link
 *       FrenchTitleMatch.Confidence#AUTHOR_ONLY}: nothing of the searched series
 *       matched, it is only a French book by this author. Two
 *       safeguards frame this resort - here, only a record of a
 *       NUMBERED volume is accepted (see {@link #parse}, {@code
 *       requireVolumeNumber}); on the caller side, the title is checked against the
 *       catalog before being kept (see
 *       FrenchTitleService.namesAnotherKnownWork) - without which "Vagabond"
 *       (Takehiko Inoue) resolved to "Slam Dunk", his best
 *       known work, checked live (see history of the conversation).</li>
 * </ol>
 * Searching by title alone (without author) only does step 1: it mostly brings up
 * French-language merchandising (planners, goodies) rather than the
 * volumes of the manga itself, no use going further without an author to
 * disambiguate.
 */
@Component
@Order(1)
public class OpenLibraryFrenchTitleProvider implements FrenchTitleProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenLibraryFrenchTitleProvider.class);
    // limit=10 (same fix as the twin GoogleBooksFrenchTitleProvider,
    // see history): the "author only" last resort is the
    // noisiest of the cascade, a usable numbered-volume result being able to
    // appear beyond the first 5 results for a prolific author.
    private static final String SEARCH_URL = "https://openlibrary.org/search.json?q=%s&language=fre&limit=10";

    // "Death Note, Vol. 1" / "L'Attaque des Titans Vol. 13" / "Naruto 58" -
    // Open Library indexes each volume separately with its number in the
    // title; we only want the series title to pre-fill the addition.
    // "-" added to the separator (same fix as the twin
    // GoogleBooksFrenchTitleProvider.VOLUME_SUFFIX, see history - "-"
    // checked manually on "Détective Conan - Tome 14" on the Google
    // Books side): without it, a title separated by a dash rather than a comma
    // left a residual dash that then prevented any prefix match on the
    // volume search side. "("/")" added (same fix as the
    // twin, see history - checked manually on "Gloutons et
    // Dragons (Tome 12)", real French title of "Delicious in Dungeon"):
    // without them, this PARENTHESIZED volume number was never recognized as
    // such, making the "author only" last resort fall back on another
    // book by the same author without a volume number.
    private static final Pattern VOLUME_KEYWORD_SUFFIX = Pattern.compile("(?i)[,\\-–(]?\\s*(vol\\.?|tome|t\\.?)\\s*\\d+\\)?\\s*$");
    private static final Pattern TRAILING_NUMBER_SUFFIX = Pattern.compile("\\s+\\d+\\s*$");

    // Words too generic to serve as a distinctive keyword (step 2 of the
    // cascade) - common English, romaji particles, manga vocabulary.
    private static final Set<String> STOPWORDS = Set.of(
            "the", "of", "on", "in", "no", "wa", "to", "and", "next",
            "generations", "story", "chronicles", "complete", "series",
            "vol", "tome", "edition", "part");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }

        Optional<String> exactMatch = search(combine(author, query), excludedTitleFragments, false);
        if (exactMatch.isPresent()) {
            return exactMatch.map(FrenchTitleMatch::seriesMatched);
        }

        if (author == null || author.isBlank()) {
            return Optional.empty();
        }

        for (String keyword : significantWords(query)) {
            Optional<String> byKeyword = search(combine(author, keyword), excludedTitleFragments, false);
            if (byKeyword.isPresent()) {
                return byKeyword.map(FrenchTitleMatch::seriesMatched);
            }
        }

        // A single name (one word, e.g. "Takahiro" - common pen name among
        // manga writers) is too risky to search ALONE - see
        // isTooGenericForAuthorOnlySearch.
        if (isTooGenericForAuthorOnlySearch(author)) {
            return Optional.empty();
        }
        // requireVolumeNumber: see javadoc of the class and of parse().
        return search(author, excludedTitleFragments, true).map(FrenchTitleMatch::authorOnly);
    }

    /**
     * True if {@code author} fits in a single word - too risky to search
     * ALONE as a last resort (see {@link #findFrenchTitle}): Open Library
     * matches any author whose name CONTAINS this word, including
     * a totally UNRELATED real person who just shares a common
     * first name - worse than the risk already documented elsewhere (see
     * {@link #parse}, falling back on ANOTHER work by the SAME author): here, it
     * is not even the right author. Real case found while continuing the tests
     * on "Akame ga Kill" (see history): "Takahiro" (the writer)
     * brought up "Trapped Life" by "Haruki Takahiro", a different
     * person with no relation. A FULL name (several words) is still
     * tried as is: much more distinctive, the risk of collision becomes
     * minimal.
     */
    static boolean isTooGenericForAuthorOnlySearch(String author) {
        return !author.trim().contains(" ");
    }

    private static String combine(String author, String text) {
        return (author == null || author.isBlank()) ? text : author + " " + text;
    }

    /** Words of 4+ characters excluding stop words, in order of appearance, without
     * duplicates - candidates tried one by one when author+full title
     * matches nothing. Deliberately capped (see findFrenchTitle): each word
     * tried is one more network call. */
    static List<String> significantWords(String title) {
        return Arrays.stream(title.split("[\\s:,.'’-]+"))
                .filter(word -> word.length() >= 4)
                .filter(word -> !STOPWORDS.contains(word.toLowerCase()))
                .filter(word -> !word.chars().allMatch(Character::isDigit))
                .distinct()
                .limit(3)
                .collect(Collectors.toList());
    }

    private Optional<String> search(String rawQuery, List<String> excludedTitleFragments, boolean requireVolumeNumber) {
        try {
            String encodedQuery = URLEncoder.encode(rawQuery, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Open Library answered {} for the French title search '{}'", response.statusCode(), rawQuery);
                return Optional.empty();
            }

            return parse(response.body(), excludedTitleFragments, requireVolumeNumber);
        } catch (Exception e) {
            log.warn("Open Library French title search failed for '{}': {}", rawQuery, e.getMessage());
            return Optional.empty();
        }
    }

    Optional<String> parse(String body) throws Exception {
        return parse(body, List.of());
    }

    /** Variant with exclusion of known sequels/spin-offs (see RelatedSeriesService) -
     * separated from {@link #parse(String)} so as not to break the existing tests
     * that do not need it. */
    Optional<String> parse(String body, List<String> excludedTitleFragments) throws Exception {
        return parse(body, excludedTitleFragments, false);
    }

    /**
     * @param requireVolumeNumber accept ONLY records of a numbered volume,
     *                            never falling back on a result without
     *                            a number - reserved for the "author
     *                            only" last resort (see {@link #findFrenchTitle}), the
     *                            only step of the cascade where the results
     *                            are linked to the searched series by
     *                            NOTHING: a book without a volume number there is
     *                            almost always an artbook/guide/one-shot
     *                            by the same author ("Les Sept Rejetons du
     *                            dragon" for "Delicious in Dungeon",
     *                            checked live), not the French edition
     *                            searched.
     */
    Optional<String> parse(String body, List<String> excludedTitleFragments, boolean requireVolumeNumber) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        // Fallback if NO result has an extractable volume number (see
        // below) - never the default choice: a real multi-volume manga
        // almost always has one in the first 5 results.
        String firstResultWithoutTomeNumber = null;
        for (JsonNode doc : root.path("docs")) {
            String rawTitle = doc.path("title").asText(null);
            if (rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            // "language=fre" in the request (see SEARCH_URL) only guarantees
            // the existence of ONE French edition among all those of
            // the work - the returned "title" field stays the canonical title of
            // the work, often in Japanese for a manga (e.g. "名探偵コナン"
            // for "Detective Conan"/"Détective Conan", checked manually
            // while continuing the tests, see history): Open Library does not
            // offer a title PER EDITION in this search endpoint,
            // unlike Google Books where "language" is
            // checked PER VOLUME just below (see
            // GoogleBooksFrenchTitleProvider). A French title never contains
            // any sinogram/kana/hangul - an inexpensive safety net
            // before keeping it as a "French title".
            if (containsCjkCharacters(rawTitle)) {
                continue;
            }
            // "Dragon Ball Super nº 18" comes out as the first result for
            // "Dragon Ball Akira Toriyama" (checked manually, see
            // history) - Open Library ranks it before the real "Dragon
            // Ball, tome 1", exactly the same popularity bias already
            // met on the Google Books side (see GoogleBooksVolumeSearchProvider).
            // "Dragon Ball Super" does share the prefix "Dragon
            // Ball" though - a simple prefix filter would not be enough here,
            // only this external information (sequel/spin-off known on
            // MyAnimeList) allows dropping it.
            if (matchesKnownRelatedSeries(rawTitle, excludedTitleFragments)) {
                continue;
            }
            String trimmedTitle = rawTitle.trim();
            String cleaned = cleanVolumeSuffix(trimmedTitle);
            if (cleaned.isBlank()) {
                continue;
            }
            // A volume number was indeed removed (cleaned != trimmedTitle):
            // strong signal that it is a real volume record of the
            // series, not a simple homonym - same fix as the
            // twin GoogleBooksFrenchTitleProvider (see history):
            // "L'Art des Sorciers" (unrelated artbook, same author)
            // before "L'Atelier des Sorciers T15" (the real manga).
            if (!cleaned.equals(trimmedTitle)) {
                return Optional.of(cleaned);
            }
            if (firstResultWithoutTomeNumber == null) {
                firstResultWithoutTomeNumber = cleaned;
            }
        }
        return requireVolumeNumber ? Optional.empty() : Optional.ofNullable(firstResultWithoutTomeNumber);
    }

    // Kanji/hiragana/katakana/hangul - never present in a real
    // French title, see javadoc of parse().
    private static final Pattern CJK_CHARACTERS = Pattern.compile("[\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}\\p{IsHangul}]");

    private static boolean containsCjkCharacters(String text) {
        return CJK_CHARACTERS.matcher(text).find();
    }

    /** Whole word comparison (?U to recognize accented letters
     * as word characters) - a simple contains() would make a generic/short
     * fragment match inside another unrelated word. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }

    /** "L'Attaque des Titans Vol. 13" -> "L'Attaque des Titans", "Naruto 58" -> "Naruto". */
    static String cleanVolumeSuffix(String rawTitle) {
        String withoutKeywordSuffix = VOLUME_KEYWORD_SUFFIX.matcher(rawTitle).replaceFirst("");
        return TRAILING_NUMBER_SUFFIX.matcher(withoutKeywordSuffix).replaceFirst("").trim();
    }
}
