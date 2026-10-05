package com.iozycore.manga.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.manga.metadata.FrenchTitleMatch;
import com.iozycore.manga.metadata.FrenchTitleProvider;
import com.iozycore.core.metadata.QuotaExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Best-effort search of a French edition title via Google Books,
 * triggered only when the user chooses a Jikan/
 * MyAnimeList suggestion (never for a whole list of results - see
 * FrenchTitleService.findFrenchTitle, cached): neither Jikan nor
 * MyAnimeList know a French title, unlike Google
 * Books which indexes editions by language.
 * <p>
 * Fallback (@Order(2)) behind {@link com.iozycore.manga.metadata.openlibrary.OpenLibraryFrenchTitleProvider}:
 * the anonymous Google Books quota is often exhausted (429) in practice -
 * Open Library (no key, no aggressive quota) is tried first.
 * <p>
 * Search on purpose in free text ({@code q=}), not in
 * {@code intitle:}: the searched term (romaji/English) by
 * definition does NOT appear in a translated French title (e.g. searching "Attack on
 * Titan" in intitle will never find "L'Attaque des Titans") - a free
 * search has a chance to match through the metadata/description
 * of a well cataloged record. It stays a best-effort: no guarantee of
 * result, and a thematically close false positive cannot be ruled out.
 * <p>
 * Additional fallback on the author alone (checked manually, see
 * history of the conversation): "Forget Me Not" (Nao Emoto) is published
 * in France under the title "Fragments d'elles" - NO word in common with the
 * original title, so the title+author combination never matches anything.
 * Searching the author alone brings up "Fragments d'elles" as the very first
 * French result - same idea as the last resort already in place
 * on the OpenLibraryFrenchTitleProvider side, and framed by the same two
 * safeguards: only a record of a NUMBERED volume is accepted at this step
 * (see {@link #parse}, {@code requireVolumeNumber}), and the title returned
 * as {@link FrenchTitleMatch.Confidence#AUTHOR_ONLY} is checked against the
 * catalog by the caller before being kept (see
 * FrenchTitleService.namesAnotherKnownWork).
 */
@Component
@Order(2)
public class GoogleBooksFrenchTitleProvider implements FrenchTitleProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksFrenchTitleProvider.class);
    // maxResults=10 (raised from 5, checked manually on "Zom 100", see
    // history): the "author only" last resort (see findFrenchTitle)
    // is the noisiest of the cascade - a prolific author can have
    // SEVERAL one-shots/reissues without a volume number before the first
    // usable numbered-volume result ("Bucket List of the Dead - Tome
    // 19", the real French title of "Zom 100", only appeared in 8th
    // position among the results for "Haro Aso").
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=%s&langRestrict=fr&maxResults=10";

    // "Fragments d'elles T04" - Google Books indexes the scanned volume, not the
    // series: we only want the series title to pre-fill the addition.
    // Same idea as OpenLibraryFrenchTitleProvider.cleanVolumeSuffix,
    // duplicated here (providers independent on purpose) rather than
    // shared, like the rest of the regexes of this module. "-" added to the separator
    // (checked manually on "Détective Conan - Tome 14", see history):
    // without it, only " Tome 14" was removed, leaving "Détective Conan -"
    // with a residual dash that then prevented any prefix match on the
    // volume search side (66 results without it, only 2 with). "("/")"
    // added (checked manually on "Gloutons et Dragons (Tome 12)" -
    // real French title of "Delicious in Dungeon", see history): without
    // them, this PARENTHESIZED volume number was never recognized as such by
    // {@link #parse}, which then fell back on another book by the same author
    // without a volume number ("Les Sept Rejetons du dragon", unrelated).
    private static final Pattern VOLUME_SUFFIX = Pattern.compile("(?i)[,\\-–(]?\\s*(vol\\.?|tome|t\\.?)\\s*\\d+\\)?\\s*$");

    private final GoogleBooksHttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GoogleBooksFrenchTitleProvider(GoogleBooksHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Constructor used by the unit tests: parse()/search() on a
     * body already in memory never need a real network call. */
    GoogleBooksFrenchTitleProvider() {
        this(new GoogleBooksHttpClient("", ""));
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }
        String combinedQuery = (author == null || author.isBlank()) ? query : author + " " + query;

        Optional<String> result = search(combinedQuery, excludedTitleFragments, false);
        if (result.isPresent()) {
            return result.map(FrenchTitleMatch::seriesMatched);
        }

        // Last resort: author alone, without the original title which may
        // share no word with the French edition (see javadoc). Accepts
        // the risk of falling back on another work by the same author if nothing
        // else matched - same limit already documented on the Open Library side.
        //
        // inauthor: structured, never free text here: checked
        // manually that a free search `q=Nao Emoto` brings up "New
        // Authentic Magical Girl" (Nisioisin, unrelated) - Google matches
        // the two words separately anywhere in the record, whereas
        // inauthor: requires a real match on the author field.
        //
        // A single name is nevertheless rejected even via inauthor: (see
        // OpenLibraryFrenchTitleProvider.isTooGenericForAuthorOnlySearch,
        // same risk, real case found while continuing the tests on "Akame ga
        // Kill", see history): inauthor:"Takahiro" also matches
        // "Takahiro Arai" (illustrator of an adaptation of Les Misérables,
        // a different person from the single-name writer of Akame ga Kill) -
        // Google Books does not seem to require an EXACT match of the
        // author field with inauthor: either, just that one of the listed names
        // CONTAINS the searched term.
        if (author == null || author.isBlank() || isTooGenericForAuthorOnlySearch(author)) {
            return Optional.empty();
        }
        // requireVolumeNumber: see javadoc of the class and of parse().
        return search("inauthor:\"" + author + "\"", excludedTitleFragments, true)
                .map(FrenchTitleMatch::authorOnly);
    }

    /** See OpenLibraryFrenchTitleProvider.isTooGenericForAuthorOnlySearch
     * (same risk, duplicated here like the rest of the regexes of this module). */
    static boolean isTooGenericForAuthorOnlySearch(String author) {
        return !author.trim().contains(" ");
    }

    private Optional<String> search(String rawQuery, List<String> excludedTitleFragments, boolean requireVolumeNumber) {
        try {
            String encodedQuery = URLEncoder.encode(rawQuery, StandardCharsets.UTF_8);
            String body = httpClient.get(SEARCH_URL.formatted(encodedQuery));
            return parse(body, excludedTitleFragments, requireVolumeNumber);
        } catch (QuotaExceededException e) {
            // Open Library is already tried first (see @Order) - no
            // user alarm needed for this fallback.
            log.warn("Google Books quota exceeded for the French title search '{}'", rawQuery);
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Google Books French title search failed for '{}': {}", rawQuery, e.getMessage());
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
     *                            only" last resort (see {@link #findFrenchTitle}), the only
     *                            step where NOTHING links the results to the
     *                            searched series: a book without a volume
     *                            number is almost always an
     *                            artbook/guide/one-shot by the same author ("Les
     *                            Sept Rejetons du dragon" and "Gloutons et
     *                            Dragons : guide officiel" both arrive
     *                            BEFORE "Gloutons et Dragons (Tome 12)" for
     *                            inauthor:"Ryoko Kui", checked live),
     *                            not the French edition searched.
     */
    Optional<String> parse(String body, List<String> excludedTitleFragments, boolean requireVolumeNumber) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        if (root.path("totalItems").asInt(0) == 0) {
            return Optional.empty();
        }

        // Fallback if NO result has an extractable volume number (see
        // below) - never the default choice: a real multi-volume manga
        // almost always has one in the first 5 results.
        String firstResultWithoutTomeNumber = null;
        for (JsonNode item : root.path("items")) {
            JsonNode volumeInfo = item.path("volumeInfo");
            // langRestrict is a preference on Google's side, not an absolute guarantee -
            // we check the declared language of the volume again before trusting the title.
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue;
            }
            String title = volumeInfo.path("title").asText(null);
            if (title == null || title.isBlank()) {
                continue;
            }
            // Same popularity bias as on the Open Library side (see
            // OpenLibraryFrenchTitleProvider, "Dragon Ball Super nº 18" for
            // a "Dragon Ball" search) - possible here too as a fallback.
            if (matchesKnownRelatedSeries(title, excludedTitleFragments)) {
                continue;
            }
            String trimmedTitle = title.trim();
            String cleaned = VOLUME_SUFFIX.matcher(trimmedTitle).replaceFirst("").trim();
            if (cleaned.isBlank()) {
                continue;
            }
            // A volume number was indeed removed (cleaned != trimmedTitle):
            // strong signal that it is a real volume record of the series,
            // not a simple homonym - real case that motivates this
            // preference (found while continuing the tests on "Witch Hat
            // Atelier", see history): the "author only" fallback (see
            // {@link #findFrenchTitle}) first brought up "L'Art des
            // Sorciers", an unrelated ARTBOOK by the same author, before
            // "L'Atelier des Sorciers T15" (the real manga, correctly
            // numbered) a bit further in the same results.
            if (!cleaned.equals(trimmedTitle)) {
                return Optional.of(cleaned);
            }
            if (firstResultWithoutTomeNumber == null) {
                firstResultWithoutTomeNumber = cleaned;
            }
        }
        return requireVolumeNumber ? Optional.empty() : Optional.ofNullable(firstResultWithoutTomeNumber);
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
}
