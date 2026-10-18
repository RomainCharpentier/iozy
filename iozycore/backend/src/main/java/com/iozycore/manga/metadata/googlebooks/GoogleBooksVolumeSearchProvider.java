package com.iozycore.manga.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Searches the real volumes (with cover) of the French editions of a
 * manga series via Google Books.
 * <p>
 * A single generic {@code intitle:}+{@code inauthor:} request turned out to be
 * insufficient in practice (checked manually, see history of the
 * conversation): Google Books ranks results by relevance/popularity,
 * not by editorial completeness - for "Dragon Ball", the generic request
 * (even paginated over 120 results) returns ONLY the "Perfect Edition",
 * the original edition never appearing in the first 40/80/120
 * results. There is no free equivalent to the hand-edited
 * catalog of Mangacollec.
 * <p>
 * Workaround: one request per common French edition keyword, launched
 * in parallel ({@link CompletableFuture}) rather than in series so as not to
 * add up their latencies - each targets a precise edition, which
 * works around the popularity bias of the generic request. Result merged
 * and deduplicated only once at the end (not edition by edition: the same
 * volume can appear in several requests, e.g. the empty request AND the
 * "perfect edition" request can both bring up a Perfect
 * Edition volume). It stays best-effort: an edition absent from all these keywords
 * (unusual collection name) will stay invisible.
 * <p>
 * Non-negligible external quota cost (one request per keyword): split
 * into {@link #QUICK_EDITION_KEYWORDS} (3, launched at each search - covers
 * the great majority of mangas, which have no special edition) and
 * {@link #DEEP_EDITION_KEYWORDS} (5, launched only on demand via
 * {@link #searchAdditionalEditions}, see button "Chercher plus d'éditions"
 * on the client side) - checked manually (see history of the conversation):
 * systematically launching the 8 keywords was the biggest item of
 * quota consumption of the whole application.
 */
@Component
// Behind the BnF (Batch 119): a daily quota, eight requests per
// search, and editions guessed in a free title. Still
// essential for the covers, which the BnF does not have.
@Order(2)
@Slf4j
public class GoogleBooksVolumeSearchProvider implements VolumeSearchProvider {

    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=%s&langRestrict=fr&maxResults=40";

    // Launched automatically at EACH search (searchVolumes) - "" covers
    // the base/plain edition (generally carries no suffix in its
    // own title), "perfect edition"/"edition originale" are the two
    // most requested special edition types of the French-language manga market
    // and the ones that concretely motivated the keyword search in this
    // session (Dragon Ball Perfect Edition, One Piece Édition Originale -
    // absent from the first 120 results of a generic request, see
    // javadoc of the class). The great majority of mangas have no
    // special edition: these 3 requests are enough to cover their case, instead
    // of paying the 8 keywords every time (checked manually,
    // see history of the conversation - it is the biggest item of
    // quota consumption of the whole application).
    private static final List<String> QUICK_EDITION_KEYWORDS = List.of("", "perfect edition", "edition originale");

    // Launched only on demand (see searchAdditionalEditions, button
    // "Chercher plus d'éditions" on the client side) - rarer edition types,
    // mostly relevant for the big franchises with multiple reissues
    // (Naruto Star Edition, boxes/omnibus, collector editions...).
    private static final List<String> DEEP_EDITION_KEYWORDS = List.of(
            "star edition", "ultimate edition", "deluxe", "intégrale", "collector",
            // Common French format (Ki-oon, Pika...): two volumes in one.
            // Reported on "Doubt" (Batch 123), published in 4 single volumes and
            // 2 double volumes - no keyword searched for it.
            "édition double");

    // "Tome 5", "Vol. 12", "T.3", "T04" (abbreviated form without dot, common
    // on Google Books - e.g. "Fragments d'elles T04", checked manually)
    // - captures the number. \b before "t" avoids confusion with a simple
    // "t" at the end of another word; the required keyword (never just a number at the
    // end of the title) avoids confusion with a year or a chapter number.
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(?i)\\b(?:tome|vol\\.?|t\\.?)\\s*0*(\\d+)");
    // "One Piece édition originale - Chapitre 648" - sale of a single digital
    // chapter, never a real physical volume: to exclude even if a
    // volume number appears elsewhere in a neighboring record of the same result.
    private static final Pattern CHAPTER_KEYWORD = Pattern.compile("(?i)\\bchapitre\\b|\\bchapter\\b");
    // "Doubt Tome 1 à 4", "Naruto tomes 1-3": a box set, not a volume.
    // Without this guard, the probe of volume 1 (Batch 125) took it for a
    // volume 1 of a named edition "4" (Batch 126).
    private static final Pattern RANGE_KEYWORD = Pattern.compile("(?i)\\btomes?\\s*\\d+\\s*(?:à|a|-|–)\\s*\\d+\\b");
    // "." added (checked manually, see history): "Chainsaw Man
    // Tome 18 . Edition collector" has its volume number BEFORE the
    // collection name, separated by a dot - without it, the extracted edition
    // stayed ". Edition collector" (residual dot not cleaned).
    // "()" added (checked manually, see history): "Yu-Gi-Oh !
    // (Intégrale) - Tome 1" has its collection name in parentheses - without
    // them in this class, the extracted edition stayed "(Intégrale)" instead
    // of "Intégrale".
    private static final Pattern LEADING_TRAILING_SEPARATORS = Pattern.compile("^[\\s\\-–:,.()]+|[\\s\\-–:,.()]+$");
    // "L'Attaque des Titans - L'intégrale T01 à T04" (box set grouping 4
    // volumes, checked manually): VOLUME_NUMBER does remove "T01" AND "T04"
    // (two numbers in the same title), but the connector "à" between the
    // two stays alone in the middle of the remaining text - neither at the start nor at the end, so
    // not cleaned by LEADING_TRAILING_SEPARATORS - and ends up capitalized
    // as "À" by capitalizeWords: "L'intégrale à" -> "L'intégrale À".
    // (?U) essential here: \b is by default based on ASCII \w (Java), which
    // does NOT consider "à" a word character - surrounded by spaces on both
    // sides (two non-words), \bà\b without (?U) never matches (no
    // word/non-word transition detected). (?U) makes \w Unicode-aware.
    private static final Pattern DANGLING_RANGE_CONNECTOR = Pattern.compile("(?iU)\\bà\\b");

    private final GoogleBooksHttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GoogleBooksVolumeSearchProvider(GoogleBooksHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Constructor used by the unit tests: parse()/extractCandidates()
     * never call httpClient - only searchVolumes() needs it, never
     * exercised in these tests which directly pass a response body already
     * in memory. */
    GoogleBooksVolumeSearchProvider() {
        this(new GoogleBooksHttpClient("", ""));
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }

        // Quota probably still exhausted on all keys (see
        // GoogleBooksHttpClient.isQuotaLikelyExhausted): a single call (the
        // base keyword) instead of 3, so as not to waste on almost certain
        // failures the capacity that is only starting to come back.
        List<String> keywordsToTry = httpClient.isQuotaLikelyExhausted() ? List.of("") : QUICK_EDITION_KEYWORDS;
        return runKeywordSearches(seriesTitle, author, keywordsToTry, excludedTitleFragments);
    }

    @Override
    public List<VolumeCandidate> searchAdditionalEditions(String seriesTitle, String author, List<String> excludedTitleFragments) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }
        // Voluntary action, already expensive by nature (5 requests): if the
        // quota is probably still exhausted, do not waste them on almost
        // certain failures - fail right away rather than silently.
        if (httpClient.isQuotaLikelyExhausted()) {
            throw new QuotaExceededException(
                    "Quota Google Books probablement encore épuisé - recherche approfondie ignorée pour '" + seriesTitle + "'");
        }
        return runKeywordSearches(seriesTitle, author, DEEP_EDITION_KEYWORDS, excludedTitleFragments);
    }

    private List<VolumeCandidate> runKeywordSearches(String seriesTitle, String author, List<String> keywords, List<String> excludedTitleFragments) {
        AtomicBoolean anyQuotaExceeded = new AtomicBoolean(false);
        AtomicBoolean anySourceUnavailable = new AtomicBoolean(false);
        List<CompletableFuture<List<VolumeCandidate>>> searches = keywords.stream()
                .map(keyword -> CompletableFuture.supplyAsync(
                        () -> searchOneEdition(seriesTitle, author, keyword, excludedTitleFragments, anyQuotaExceeded, anySourceUnavailable)))
                .collect(Collectors.toList());

        List<VolumeCandidate> combined = searches.stream()
                .flatMap(future -> future.join().stream())
                .collect(Collectors.toList());

        List<VolumeCandidate> result = mergeAndFinalize(combined);

        // An empty list can be a real absence of French edition, or
        // the Google Books quota exceeded on all the requests - telling
        // them apart allows TomeSearchService to report it
        // explicitly instead of wrongly letting believe "no edition
        // found" (see history of the conversation).
        if (result.isEmpty() && anyQuotaExceeded.get()) {
            throw new QuotaExceededException("Quota Google Books dépassé pour la recherche de tomes de '" + seriesTitle + "'");
        }
        // Same reasoning for a source that did not answer at all (503,
        // timeout): this was the flaw of Batch 58 - "Aucune trouvée cette
        // fois." shown, and the empty list cached durably, while
        // the volume existed at the provider.
        if (result.isEmpty() && anySourceUnavailable.get()) {
            throw new SourceUnavailableException("Google Books n'a pas répondu pour la recherche de tomes de '" + seriesTitle + "'");
        }
        return result;
    }

    /**
     * Step common to {@link #runKeywordSearches} (production, N real
     * HTTP requests) and to the regression tests of this class (fixtures
     * already in memory, one per simulated keyword): deduplication, one-shot
     * resolution, then anti-noise filter - in this precise order, see
     * each of the called methods for details. Package-private (not
     * {@code private}) for exactly this reason: faithfully reproducing
     * the complete chain of steps is what revealed the hidden interaction
     * between two independent bugs on "Sword Art Online" (see
     * history) - invisible when testing each step in isolation.
     */
    static List<VolumeCandidate> mergeAndFinalize(List<VolumeCandidate> combined) {
        List<VolumeCandidate> deduped = dedupeAndSort(combined);
        // filterOutNoiseEditions assumes multi-volume editions (see its
        // javadoc) - never applicable to a one-shot resolved by
        // resolveOneShotFallback, which by nature has only ONE copy
        // per edition.
        boolean isProbableOneShot = !deduped.isEmpty() && deduped.stream().allMatch(candidate -> candidate.volumeNumber() == 0);
        return isProbableOneShot
                ? resolveOneShotFallback(deduped)
                : filterOutNoiseEditions(resolveOneShotFallback(deduped));
    }

    /**
     * 0 (see {@code candidates.add} in {@link #extractCandidates}) marks
     * a bare title without "Tome N" - a probable one-shot ("Re/member",
     * "Hideout", checked manually, see history) since a
     * complete manga in a single volume has by nature no reason to be numbered.
     * <p>
     * Only triggers if absolutely ALL the candidates of the batch are in
     * this case - a mix of numbered volumes and bare titles indicates a
     * real multi-volume series that is poorly covered (the bare title is then noise,
     * e.g. an incomplete record of the same volume already seen elsewhere with its
     * number), never a one-shot: in this case, the bare titles are
     * simply dropped, never promoted.
     */
    private static List<VolumeCandidate> resolveOneShotFallback(List<VolumeCandidate> candidates) {
        if (candidates.isEmpty() || candidates.stream().anyMatch(candidate -> candidate.volumeNumber() > 0)) {
            return candidates.stream().filter(candidate -> candidate.volumeNumber() > 0).collect(Collectors.toList());
        }
        return candidates.stream()
                .map(candidate -> new VolumeCandidate(candidate.edition(), 1, candidate.imageUrl(), candidate.title()))
                .collect(Collectors.toList());
    }

    /** An "edition" with a single volume almost always comes from a false positive
     * of the full-text search (e.g. "One Piece Party", a derived work that
     * contains the title of the series without being an edition of it) rather than
     * from a real small collection - we drop it, BUT only if there exists
     * elsewhere at least one solidly represented edition (2+ volumes):
     * without this "control group", nothing allows telling an isolated false positive
     * from a coverage that is simply sparse on ALL the editions
     * found at once (see real case below) - in this last case,
     * it is better to show them all than to drop everything.
     * <p>
     * Real case that motivates this relaxation (reported while testing "Sword Art
     * Online", see history): the arcs "Aincrad", "Progressive" and
     * "Ordinal Scale" each only come out with ONE volume found
     * (Google Books coverage limit on this series, not a false
     * positive) - before this relaxation, countByEdition.size() &gt; 1
     * (three distinct editions) triggered the filter and dropped all
     * THREE, although none was noise: the whole series
     * then returned NO result.
     * <p>
     * Never applied to a one-shot already resolved by
     * {@link #resolveOneShotFallback}: a one-shot has by nature only ONE
     * copy per edition (never 2+, unlike a real multi-volume
     * series), this heuristic would otherwise always wrongly take it
     * for noise. Package-private (not {@code private}): tested
     * directly, {@link #parse(String, String)} (used by the rest of the
     * tests of this class) only represents ONE request/keyword and deliberately
     * does not call it - this filter only makes sense after the merge
     * of ALL the requests (see runKeywordSearches). */
    static List<VolumeCandidate> filterOutNoiseEditions(List<VolumeCandidate> candidates) {
        Map<String, Long> countByEdition = candidates.stream()
                .collect(Collectors.groupingBy(VolumeCandidate::edition, Collectors.counting()));
        boolean anyMultiVolumeEdition = countByEdition.values().stream().anyMatch(count -> count >= 2);
        if (countByEdition.size() <= 1 || !anyMultiVolumeEdition) {
            return candidates;
        }
        return candidates.stream()
                .filter(candidate -> countByEdition.get(candidate.edition()) >= 2)
                .collect(Collectors.toList());
    }

    private List<VolumeCandidate> searchOneEdition(String seriesTitle, String author, String editionKeyword,
                                                  List<String> excludedTitleFragments,
                                                  AtomicBoolean anyQuotaExceeded, AtomicBoolean anySourceUnavailable) {
        // Deliberately WITHOUT inauthor: IN THE QUERY (checked
        // manually three times, see history): some
        // French records do not have the author field correctly
        // filled in - combining intitle: and inauthor: can then eliminate
        // a good part or even almost all of the French results,
        // in favor of editions in other languages that take their
        // place in the results (seen on "Haikyu!!": 0 usable result
        // instead of 15+; "Golden Kamui": 1 instead of 6;
        // "Komi cherche ses mots": 2 instead of 14). isRealPrefixMatch + the
        // language check already in place are enough to drop most of the
        // irrelevant results without this filter in the query.
        // {@code author} is nevertheless passed to extractCandidates for
        // a more careful filter ON OUTPUT (authorMismatch) - see its
        // javadoc: reject a result only when Google Books explicitly lists
        // an author who has NO relation, never the absence of
        // an author, unlike inauthor: which would have excluded the whole
        // query in this case.
        String combinedQuery = "intitle:" + seriesTitle
                + (editionKeyword.isBlank() ? "" : " " + editionKeyword);

        try {
            String encodedQuery = URLEncoder.encode(combinedQuery, StandardCharsets.UTF_8);
            String body = httpClient.get(SEARCH_URL.formatted(encodedQuery));
            return extractCandidates(body, seriesTitle, excludedTitleFragments, author);
        } catch (SourceUnavailableException e) {
            // Do NOT run again here either: the other keywords may have
            // succeeded - runKeywordSearches decides, once everything is
            // gathered (see the quota comment just below).
            anySourceUnavailable.set(true);
            log.warn("Google Books did not answer for the volume search '{}': {}", combinedQuery, e.getMessage());
            return List.of();
        } catch (QuotaExceededException e) {
            // Do NOT run again here: the 7 other keywords (same exhausted
            // quota) will fail the same way - we only note the fact, aggregated
            // afterwards by searchVolumes to decide whether to report it.
            anyQuotaExceeded.set(true);
            log.warn("Google Books quota exceeded for the volume search '{}'", combinedQuery);
            return List.of();
        } catch (Exception e) {
            log.warn("Google Books volume search failed for '{}': {}", combinedQuery, e.getMessage());
            return List.of();
        }
    }

    /** Mirror of {@link #searchOneEdition} for the tests - parses a single answer
     * (edition/volume deduplicated) without going through the 8 parallel requests. */
    List<VolumeCandidate> parse(String body, String seriesTitle) throws Exception {
        return parse(body, seriesTitle, List.of());
    }

    /** Variant with exclusion of known spin-offs (see RelatedSeriesService) -
     * separated from {@link #parse(String, String)} so as not to break the existing
     * tests that do not need it. */
    List<VolumeCandidate> parse(String body, String seriesTitle, List<String> excludedTitleFragments) throws Exception {
        return parse(body, seriesTitle, excludedTitleFragments, null);
    }

    /** Variant with author check (see {@link #authorMismatch}) -
     * separated from {@link #parse(String, String, List)} so as not to break the
     * existing tests that do not need it ({@code author} null =
     * check disabled, as if the caller did not know it). */
    List<VolumeCandidate> parse(String body, String seriesTitle, List<String> excludedTitleFragments, String author) throws Exception {
        return resolveOneShotFallback(dedupeAndSort(extractCandidates(body, seriesTitle, excludedTitleFragments, author)));
    }

    /** Extracts the raw candidates of a Google Books answer, WITHOUT deduplicating -
     * deduplication is done only once, after merging all the requests
     * (see searchVolumes), to never prefer arbitrarily the result
     * of one request over another before having seen everything. Package-private
     * (not {@code private}): called directly by the regression tests
     * of this class to simulate SEVERAL answers (one per keyword) before
     * merging them via {@link #mergeAndFinalize}, without depending on the network. */
    List<VolumeCandidate> extractCandidates(String body, String seriesTitle, List<String> excludedTitleFragments, String author) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<VolumeCandidate> candidates = new java.util.ArrayList<>();

        for (JsonNode item : root.path("items")) {
            JsonNode volumeInfo = item.path("volumeInfo");
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue; // langRestrict is a preference, not a guarantee - we check again
            }
            String title = volumeInfo.path("title").asText(null);
            if (title == null || title.isBlank() || CHAPTER_KEYWORD.matcher(title).find()
                    || RANGE_KEYWORD.matcher(title).find()) {
                continue;
            }
            // The full-text search sometimes matches a DIFFERENT series that
            // just mentions the searched series in a longer title (e.g.
            // "Boruto - Naruto Next Generations - Tome 3" brought up for a
            // "Naruto" search - Boruto is a spin-off, not an edition of
            // Naruto). Requiring the title to really start with the searched series
            // drops these false positives without depending on a list of derived
            // series names to maintain by hand.
            //
            // A simple startsWith is not enough: "Tokyo Ghoul:re Tome 5"
            // (checked manually, see history) does start with
            // "Tokyo Ghoul" but ":re" is a sequel/separate series on
            // MyAnimeList, not an edition of Tokyo Ghoul - unlike
            // a real collection name ("One Piece - Édition originale",
            // "Dragon Ball perfect edition"...), always separated from the title of
            // the series by a space. So we require the prefix to be followed
            // by a space (or the end of the string), never glued
            // directly to other letters.
            //
            // matchSeriesPrefix (not a simple startsWith) also tolerates
            // differences of spaces/hyphens INSIDE the prefix itself -
            // real cases observed (see history): the MyAnimeList title
            // "One Punch Man" (space) did not match "ONE-PUNCH MAN - tome
            // 18" (hyphen) on the Google Books side, and "Haikyu!!" (no space) did not
            // match "Haikyu !! - Les As du volley T10" (space before
            // "!!") - two very well known mangas, entirely invisible to the
            // volume search because of this rigidity alone.
            String trimmedTitle = title.trim();
            int prefixEnd = matchSeriesPrefix(trimmedTitle, seriesTitle.trim());
            boolean isRealPrefixMatch = prefixEnd >= 0
                    && (prefixEnd == trimmedTitle.length() || Character.isWhitespace(trimmedTitle.charAt(prefixEnd)));
            if (!isRealPrefixMatch) {
                continue;
            }
            // A SHORT/generic series title (e.g. "Monster", "Vagabond")
            // can be the EXACT prefix of a totally different work
            // (e.g. "Monster Allergy Next Gen", an Italian comic unrelated to the
            // "Monster" of Naoki Urasawa - checked
            // manually, see history) - the prefix alone is then no longer
            // enough to confirm it is the same work.
            if (authorMismatch(volumeInfo, author)) {
                continue;
            }
            // KNOWN spin-off/side-story (see RelatedSeriesService, derived from the
            // MyAnimeList relations): even structurally identical to a
            // real collection name ("Series - Spin-off - Tome N"), checked
            // manually on "Blue Lock - Episode Nagi" and "Demon Slayer
            // School Days" (see history) - startsWith alone cannot
            // tell them apart from a real edition, unlike this external
            // information.
            if (matchesKnownRelatedSeries(trimmedTitle, excludedTitleFragments)) {
                continue;
            }
            OptionalInt volumeNumber = extractVolumeNumber(trimmedTitle, prefixEnd);

            // Historical alias in parentheses glued to the series title
            // (e.g. "City Hunter (Nicky Larson)", name of the historical
            // French adaptation) - never to confuse with a real edition
            // name in parentheses ("Yu-Gi-Oh ! (Intégrale)") which,
            // for its part, must be kept (see skipLeadingAliasNotResemblingAnEdition).
            int editionStart = skipLeadingAliasNotResemblingAnEdition(trimmedTitle, prefixEnd);

            // "Re/member", "Hideout" (checked manually, see history):
            // a one-shot (complete manga in a single volume) has by nature no
            // "Tome N" in its title - the raw title IS then exactly the
            // title of the series, nothing more. Not to confuse with a
            // "Death Note Complete Box Set" (box set) or an artbook, which have
            // no volume number EITHER but leave descriptive text
            // after the series title - only a bare title (nothing
            // after the recognized prefix) is a valid one-shot candidate;
            // runKeywordSearches then decides, once ALL the results are
            // seen, whether it really is one (see resolveOneShotFallback).
            boolean isBareTitleMention = editionStart == trimmedTitle.length();
            if (volumeNumber.isEmpty() && !isBareTitleMention) {
                continue; // box set, artbook... without a usable number and not just the bare title
            }

            String publisher = volumeInfo.path("publisher").asText(null);
            String edition = extractEdition(trimmedTitle, editionStart, seriesTitle, publisher);

            String imageUrl = volumeInfo.path("imageLinks").path("thumbnail").asText(null);
            if (imageUrl != null) {
                imageUrl = imageUrl.replaceFirst("^http://", "https://");
            }

            // 0 = volume number not extracted (see isBareTitleMention
            // above) - sentinel resolved by resolveOneShotFallback,
            // never returned as is to the caller.
            candidates.add(new VolumeCandidate(edition, volumeNumber.orElse(0), imageUrl, title,
                    isbn13(volumeInfo), annee(volumeInfo), releaseDate(volumeInfo)));
        }
        return candidates;
    }

    /** The ISBN-13 among the identifiers of the record, or null. */
    private static String isbn13(JsonNode volumeInfo) {
        for (JsonNode id : volumeInfo.path("industryIdentifiers")) {
            if ("ISBN_13".equals(id.path("type").asText(""))) {
                return id.path("identifier").asText(null);
            }
        }
        return null;
    }

    /**
     * "2010-02-04", "2010-02" or "2010", as Google Books writes
     * them - it is the release date that the release calendar reads
     * (batch 146). A pre-order record carries a future day. Any other
     * form is ignored: better no date than a date read wrong.
     */
    private static String releaseDate(JsonNode volumeInfo) {
        String date = volumeInfo.path("publishedDate").asText(null);
        if (date == null) {
            return null;
        }
        String trimmed = date.trim();
        return trimmed.matches("\\d{4}(-\\d{2}(-\\d{2})?)?") ? trimmed : null;
    }

    /** "2009", "2010-02-04": the first four digits, or null. */
    private static Integer annee(JsonNode volumeInfo) {
        String date = volumeInfo.path("publishedDate").asText(null);
        if (date == null || date.length() < 4) {
            return null;
        }
        try {
            return Integer.parseInt(date.substring(0, 4));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Pages read at most per edition, of 40 records: "One Piece Édition
     *  originale" announces 300 (measured on 2026-09-06), one French volume
     *  out of two in the first page - the BnF only held 30 out of 66. */
    private static final int PAGES_PAR_EDITION = 3;
    private static final int FICHES_PAR_PAGE = 40;

    /**
     * An edition searched by its NAME (batch 144): {@code intitle:<series>
     * <edition>}, paginated. The search by series stops at one page where
     * the plain edition takes all the room; "Naruto Hokage" returns the
     * Hokage volumes of Kana, which the BnF only holds by half. The caller
     * checks that each record really speaks of this edition (see
     * TomeSearchService.completerLesEditionsSecondaires) - here we only
     * read, page after page, until a page with nothing.
     */
    @Override
    public List<VolumeCandidate> searchEdition(String seriesTitle, String author, String editionName,
                                               List<String> excludedTitleFragments) {
        if (httpClient.isQuotaLikelyExhausted()) {
            throw new QuotaExceededException("Quota Google Books probablement encore épuisé - édition « " + editionName
                    + " » de '" + seriesTitle + "' non complétée");
        }
        String query = "intitle:" + seriesTitle + " " + editionName;
        List<VolumeCandidate> trouves = new java.util.ArrayList<>();
        for (int page = 0; page < PAGES_PAR_EDITION; page++) {
            String url = SEARCH_URL.formatted(URLEncoder.encode(query, StandardCharsets.UTF_8))
                    + "&startIndex=" + (page * FICHES_PAR_PAGE);
            List<VolumeCandidate> fiches;
            try {
                fiches = parse(httpClient.get(url), seriesTitle, excludedTitleFragments, author);
            } catch (QuotaExceededException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Google Books edition search failed '{}': {}", query, e.getMessage());
                throw new SourceUnavailableException("Google Books n'a pas répondu pour l'édition « " + editionName
                        + " » de " + seriesTitle);
            }
            if (fiches.isEmpty()) {
                break;
            }
            trouves.addAll(fiches);
        }
        return trouves;
    }

    /**
     * The volume by volume probe (Batch 125) - idea borrowed, after measuring, from the
     * MangaCollector project: {@code intitle:<series> intitle:"Tome N"} instead
     * of an edition keyword. On a short and common title, the
     * difference is brutal: "Doubt" returns 300 records (English-language essays
     * on doubt) in the search by title, none of them a usable volume;
     * the probe of volume 1 returns 4, the right one first, with its ISBN.
     *
     * <p>A trap specific to these records: Google Books often indexes the French
     * volumes under the series title alone ("Doubt", without number) - the
     * number is in its own fields, not in the title. The search by
     * title therefore threw them away (number not found). Here, we KNOW which number we
     * asked for: a record with a bare title that answers "Tome N" and carries an
     * ISBN is volume N. The ISBN is required: without it, nothing tells such a
     * record apart from the page of the whole series, which would answer everything.
     *
     * @throws QuotaExceededException when the key is exhausted - the caller
     *         stops probing and caches nothing
     */
    @Override
    public List<VolumeCandidate> probeVolume(String seriesTitle, String author, int volumeNumber,
                                             List<String> excludedTitleFragments) {
        String query = "intitle:" + seriesTitle + " intitle:\"Tome " + volumeNumber + "\"";
        try {
            String body = httpClient.get(SEARCH_URL.formatted(URLEncoder.encode(query, StandardCharsets.UTF_8)));
            List<VolumeCandidate> trouves = new java.util.ArrayList<>();
            for (VolumeCandidate candidate : extractCandidates(body, seriesTitle, excludedTitleFragments, author)) {
                if (candidate.volumeNumber() == volumeNumber) {
                    trouves.add(candidate);
                } else if (candidate.volumeNumber() == 0 && candidate.isbnNormalise() != null) {
                    trouves.add(new VolumeCandidate(candidate.edition(), volumeNumber, candidate.imageUrl(),
                            candidate.title(), candidate.isbn(), candidate.annee(), candidate.releaseDate()));
                }
            }
            return trouves;
        } catch (QuotaExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google Books probe failed '{}': {}", query, e.getMessage());
            throw new SourceUnavailableException("Google Books n'a pas répondu à la sonde du tome " + volumeNumber);
        }
    }

    /**
     * "Fuzzy" real prefix: advances in parallel in {@code title} and
     * {@code seriesTitle}, independently skipping the spaces/hyphens on
     * EACH side before comparing the next character - their number or
     * their nature (space vs hyphen, presence or not) can differ between the
     * known series title (MyAnimeList) and the real title indexed by
     * the French publisher on Google Books. A simple {@code startsWith} was not
     * enough for two very well known mangas, entirely invisible to
     * the volume search because of this rigidity alone (checked
     * manually, see history):
     * <ul>
     *   <li>"One Punch Man" (space) vs "ONE-PUNCH MAN - tome 18" (hyphen)</li>
     *   <li>"Haikyu!!" (no space) vs "Haikyu !! - Les As du volley T10"
     *       (space before "!!")</li>
     * </ul>
     *
     * @return the index in {@code title} just after the recognized prefix, or
     * -1 if {@code title} does not start with {@code seriesTitle} (give or take
     * spaces/hyphens).
     */
    private static int matchSeriesPrefix(String title, String seriesTitle) {
        int i = 0;
        int j = 0;
        while (j < seriesTitle.length()) {
            while (i < title.length() && isFlexibleSeparator(title.charAt(i))) {
                i++;
            }
            while (j < seriesTitle.length() && isFlexibleSeparator(seriesTitle.charAt(j))) {
                j++;
            }
            if (j >= seriesTitle.length()) {
                break;
            }
            if (i >= title.length() || Character.toLowerCase(title.charAt(i)) != Character.toLowerCase(seriesTitle.charAt(j))) {
                return -1;
            }
            i++;
            j++;
        }
        return i;
    }

    private static boolean isFlexibleSeparator(char c) {
        return Character.isWhitespace(c) || c == '-';
    }

    // Characteristic words of a REAL edition name (see QUICK_EDITION_KEYWORDS/
    // DEEP_EDITION_KEYWORDS) - used to tell an edition parenthesis
    // ("Yu-Gi-Oh ! (Intégrale)") from a title alias glued to the series name
    // (see skipLeadingAliasNotResemblingAnEdition just below).
    private static final List<String> EDITION_INDICATOR_WORDS = List.of(
            "edition", "édition", "perfect", "originale", "star", "ultimate", "deluxe", "intégrale", "integrale", "collector");

    /**
     * "City Hunter (Nicky Larson) Tome 1 . Edition de luxe" (checked
     * manually, see history): some titles make the series name be followed
     * by a historical alias in parentheses ("Nicky Larson", name of the
     * French adaptation of City Hunter) BEFORE the volume number - without
     * this handling, removing only the volume number in the middle of the title
     * left the closing parenthesis of the alias orphaned, mixed with the real
     * edition name that follows ("Nicky Larson) . Edition De Luxe").
     * <p>
     * Only applies if the content between parentheses does not look like
     * a known edition name - a parenthesis like "Yu-Gi-Oh ! (Intégrale)
     * - Tome 1" must on the contrary be KEPT (stripped of its
     * parentheses by {@link #LEADING_TRAILING_SEPARATORS} further on), its
     * content being the edition name itself.
     *
     * @return the index where the "rest" of the title to be processed by
     * {@link #extractEdition} starts - {@code afterSeriesPrefix} unchanged if no
     * alias of this type is detected.
     */
    private static int skipLeadingAliasNotResemblingAnEdition(String title, int afterSeriesPrefix) {
        int i = afterSeriesPrefix;
        while (i < title.length() && Character.isWhitespace(title.charAt(i))) {
            i++;
        }
        if (i >= title.length() || title.charAt(i) != '(') {
            return afterSeriesPrefix;
        }
        int closingParen = title.indexOf(')', i);
        if (closingParen < 0) {
            return afterSeriesPrefix;
        }
        String content = title.substring(i + 1, closingParen).toLowerCase();
        boolean looksLikeEditionName = EDITION_INDICATOR_WORDS.stream().anyMatch(content::contains);
        return looksLikeEditionName ? afterSeriesPrefix : closingParen + 1;
    }

    /** Whole word comparison (?U to recognize accented letters
     * as word characters, see DANGLING_RANGE_CONNECTOR above
     * for the same trap) - a simple contains() would make a
     * generic/short fragment match inside another unrelated word. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }

    /**
     * True if {@code volumeInfo} EXPLICITLY lists one or more authors
     * AND NONE of them shares a significant word with {@code expectedAuthor}
     * - strong signal that it is a totally different work that
     * just shares the same title prefix (see javadoc of
     * {@link #extractCandidates}), rather than another edition/translation of
     * the searched series.
     * <p>
     * Only applies when both pieces of information are available and
     * positive - never in case of absence (unlike {@code inauthor:}
     * IN the query, deliberately avoided, see {@link #searchOneEdition}):
     * {@code expectedAuthor} unknown, or Google Books record without a listed
     * author (frequent on French editions, checked manually) ->
     * nothing to compare, the candidate stays eligible as before this filter.
     */
    private static boolean authorMismatch(JsonNode volumeInfo, String expectedAuthor) {
        if (expectedAuthor == null || expectedAuthor.isBlank()) {
            return false;
        }
        JsonNode authorsNode = volumeInfo.path("authors");
        if (!authorsNode.isArray() || authorsNode.isEmpty()) {
            return false;
        }
        Set<String> expectedWords = significantWords(expectedAuthor);
        if (expectedWords.isEmpty()) {
            return false;
        }
        for (JsonNode authorNode : authorsNode) {
            if (!Collections.disjoint(expectedWords, significantWords(authorNode.asText("")))) {
                return false; // at least one name/word in common with a listed author -> not a mismatch
            }
        }
        return true;
    }

    /** Words of at least 3 letters (ignores particles/initials - "de", "van",
     * "Jr."...) - deliberately approximate comparison, just enough to
     * tell "Naoki Urasawa" from a work with NO name in common, not
     * to validate an exact spelling (transliteration, surname/first name order
     * varying between records). */
    private static Set<String> significantWords(String name) {
        Set<String> words = new java.util.HashSet<>();
        for (String word : name.toLowerCase().split("\\s+")) {
            if (word.length() >= 3) {
                words.add(word);
            }
        }
        return words;
    }

    /** Deduplicates by (edition, volume) - the same volume can come out of several
     * requests/records (reissue, different format, keyword requests that
     * overlap); we keep the first one with a cover rather than the first
     * one at all. Sorted by edition then volume number for a stable display. */
    private static List<VolumeCandidate> dedupeAndSort(List<VolumeCandidate> candidates) {
        Map<String, VolumeCandidate> bestByKey = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            String key = candidate.edition().toLowerCase() + "|" + candidate.volumeNumber();
            bestByKey.merge(key, candidate, (existing, replacement) -> existing.imageUrl() != null ? existing : replacement);
        }
        return bestByKey.values().stream()
                .sorted(Comparator.comparing(VolumeCandidate::edition).thenComparingInt(VolumeCandidate::volumeNumber))
                .collect(Collectors.toList());
    }

    /**
     * @param prefixEnd see {@link #matchSeriesPrefix} - allows the
     *                  {@link #BARE_ZERO_PADDED_VOLUME_NUMBER} fallback when no
     *                  keyword is found.
     */
    private static OptionalInt extractVolumeNumber(String title, int prefixEnd) {
        var matcher = VOLUME_NUMBER.matcher(title);
        if (matcher.find()) {
            try {
                return OptionalInt.of(Integer.parseInt(matcher.group(1)));
            } catch (NumberFormatException e) {
                return OptionalInt.empty();
            }
        }
        return extractBareZeroPaddedVolumeNumber(title, prefixEnd);
    }

    /**
     * "Sword Art Online 001 Aincrad" (checked manually, real
     * French edition at Ofelbe, see history): numbering convention
     * WITHOUT the keyword "Tome"/"T." or "Vol." - just a number with leading
     * zero(s) glued to the series title, before the name of the arc/volume.
     * Without this fallback, {@link #VOLUME_NUMBER} finding no keyword, this
     * whole edition (yet very real) was invisible, rejected as
     * a box set/artbook without a usable number.
     * <p>
     * Deliberately scoped to the text RIGHT AFTER the series prefix
     * ({@code prefixEnd}, see {@link #matchSeriesPrefix}), never searched
     * anywhere in the title like {@link #VOLUME_NUMBER}: an isolated number
     * elsewhere (year, price...) would be too risky to interpret as
     * a volume number without a keyword to confirm it - the leading zero
     * (never present in a usual 4-digit year) is the only
     * signal that makes this fallback reasonably safe.
     */
    private static final Pattern BARE_ZERO_PADDED_VOLUME_NUMBER = Pattern.compile("^[\\s\\-–:,.()]*0(\\d{1,3})\\b");

    private static OptionalInt extractBareZeroPaddedVolumeNumber(String trimmedTitle, int prefixEnd) {
        if (prefixEnd < 0 || prefixEnd >= trimmedTitle.length()) {
            return OptionalInt.empty();
        }
        var matcher = BARE_ZERO_PADDED_VOLUME_NUMBER.matcher(trimmedTitle.substring(prefixEnd));
        if (!matcher.find()) {
            return OptionalInt.empty();
        }
        try {
            return OptionalInt.of(Integer.parseInt(matcher.group(1)));
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    // "Panini" and "Panini Manga" designate the same real publisher on the Google
    // Books side (checked manually on "Demon Slayer", see history) -
    // some records index the full name of the manga imprint, others
    // just the parent company, for the SAME publisher. Without normalization, this
    // formed two edition tabs for a single real publisher.
    private static final Pattern TRAILING_MANGA_SUFFIX = Pattern.compile("(?i)\\s+manga$");

    /** "One Piece - Édition originale - Tome 60" + series "One Piece" -> "Édition Originale".
     * "Death Note - Tome 10" + series "Death Note" -> "" -> fallback on the publisher ("Kana").
     * {@code seriesPrefixEnd} (see {@link #matchSeriesPrefix}) - already computed
     * by the caller, never re-derived here by regex: the real prefix can
     * differ slightly from {@code seriesTitle} in spaces/hyphens (e.g.
     * "ONE-PUNCH MAN" for the series "One Punch Man"). */
    private static String extractEdition(String fullTitle, int seriesPrefixEnd, String seriesTitle, String publisher) {
        String remainder = fullTitle.substring(Math.min(seriesPrefixEnd, fullTitle.length()));
        remainder = VOLUME_NUMBER.matcher(remainder).replaceAll("");
        // Number with leading zero(s) without keyword (see
        // extractBareZeroPaddedVolumeNumber) - e.g. "Sword Art Online 001
        // Aincrad" -> keep only "Aincrad", not "001 Aincrad".
        remainder = BARE_ZERO_PADDED_VOLUME_NUMBER.matcher(remainder).replaceFirst("");
        remainder = DANGLING_RANGE_CONNECTOR.matcher(remainder).replaceAll("");
        remainder = LEADING_TRAILING_SEPARATORS.matcher(remainder).replaceAll("").trim();
        // "Team-up Mission" / "Team-Up Mission" / "Team Up Mission" (the three
        // forms really exist depending on the Google Books record, checked
        // manually on "My Hero Academia") must form ONE single
        // edition, not three almost identical tabs - the inner hyphen is
        // treated as a simple space before capitalization; only the edge
        // hyphens (already removed above) served as a separator
        // with the rest of the title.
        remainder = remainder.replace('-', ' ').replaceAll("\\s+", " ").trim();
        // "Kingdom - Tome 70 - Kingdom" (checked manually, see history):
        // the series title repeats after the volume number on some
        // Google Books records - once the prefix and the number are removed, only
        // this duplicate is left, which would otherwise look like a real
        // collection name called "Kingdom" (identical to the series itself, so
        // with no informative value). Treated as if nothing was left.
        if (remainder.equalsIgnoreCase(seriesTitle.trim())) {
            remainder = "";
        }
        if (!remainder.isBlank()) {
            return capitalizeWords(remainder);
        }
        return normalizePublisherFallback(publisher);
    }

    /** A real publisher always contains at least one letter - safety
     * net against a data inconsistency noted manually on the
     * Google Books side (see history): the SEARCH endpoint ({@code
     * /volumes?q=...}) sometimes returns a corrupted {@code publisher} field
     * ("12-21", looking like a volume range or a misplaced internal code)
     * for an id whose READ endpoint ({@code
     * /volumes/{id}}) nevertheless returns the right value ("UNIVERS POCHE") -
     * spotted on several distinct volumes of "Vinland Saga". Impossible to
     * fix at the source (no second call per id, far
     * too expensive for this best-effort) - better to fall back on "Édition
     * inconnue" than to show an absurd edition name. */
    private static String normalizePublisherFallback(String publisher) {
        if (publisher == null || publisher.isBlank() || !containsLetter(publisher)) {
            return "Édition inconnue";
        }
        return TRAILING_MANGA_SUFFIX.matcher(publisher).replaceFirst("");
    }

    private static boolean containsLetter(String text) {
        return text.chars().anyMatch(Character::isLetter);
    }

    /** "perfect edition" -> "Perfect Edition" - Google Books often indexes the
     * collection name all in lowercase in the raw title, unlike the name
     * of the publisher (already correctly cased, e.g. "Glénat Manga") used as a fallback. */
    private static String capitalizeWords(String text) {
        StringBuilder result = new StringBuilder();
        for (String word : text.split(" ")) {
            if (word.isEmpty()) {
                continue;
            }
            if (result.length() > 0) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }
}
