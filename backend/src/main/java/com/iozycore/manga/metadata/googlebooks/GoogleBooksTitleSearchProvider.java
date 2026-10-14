package com.iozycore.manga.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.core.metadata.QuotaExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Search by FRENCH title via Google Books - completes Jikan/MyAnimeList
 * which only know Japanese/English/romaji titles, never the title
 * chosen by the French publisher (Open Library, tried initially for this
 * same role, had no record for some series - see history of
 * the conversation - and was removed in favor of Google Books, which
 * indexes them abundantly).
 * <p>
 * Real case that motivates this provider (checked manually, see history of
 * the conversation): "Forget Me Not" (Nao Emoto) is published in France under
 * the title "Fragments d'elles" (Pika).
 * <p>
 * Always runs in parallel with Jikan/MyAnimeList (never as a conditional
 * fallback) - a non-relevant result from these sources cannot be told
 * in advance from a search by French title. @Order(4), after AniList(1)/
 * Jikan(2)/MyAnimeList(3) - the three databases without a daily quota go
 * before the only source that has one (Batches 118-119): MetadataSearchService.search
 * deduplicates by exact title (e.g. "Naruto", unchanged in French) keeping
 * the first one met, and these databases must win this deduplication
 * (richer attributes).
 * <p>
 * Filter by known manga publisher (checked manually, see history of
 * the conversation): a generic title like "Fragment" (a very common word
 * in French) otherwise brings up hundreds of old academic/
 * literary public domain works ("Fragment d'un mémoire sur l'éducation des
 * femmes au Moyen Âge", etc.) that completely drown the searched manga -
 * intitle: alone is not enough to limit Google Books to the manga shelf. None
 * of these false positives has a publisher field filled in, or else an
 * academic publisher (Gallimard, PUF, Editions Allia...) - never one of the
 * French-language manga publishers below.
 */
@Component
@Order(4)
public class GoogleBooksTitleSearchProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksTitleSearchProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=intitle:%s&langRestrict=fr&maxResults=20";

    // "Fragments d'elles Tome 2" / "Fragments d'elles T01" / "Naruto -
    // Tome 5" - Google Books indexes each volume separately; \b before the
    // keyword + optional dot cover "Tome N" and the abbreviated "TNN" without
    // dot (checked manually) - same rule as
    // GoogleBooksVolumeSearchProvider. The separator before the keyword
    // (comma, simple/medium dash, spaces) is also removed: without it,
    // "Naruto - Tome 5" only lost " Tome 5", leaving "Naruto -" with
    // a residual dash (seen while checking live).
    private static final Pattern VOLUME_SUFFIX = Pattern.compile("(?i)[,\\-–]?\\s*\\b(?:tome|vol\\.?|t\\.?)\\s*\\d+\\s*$");

    // Main French-language manga/comics publishers - list not exhaustive
    // by nature (a publisher missing here stays invisible to this filter), but
    // covers most of the market. "contains" comparison (case-
    // insensitive): Google Books sometimes adds a suffix ("Glénat Manga").
    private static final Set<String> KNOWN_MANGA_PUBLISHERS = Set.of(
            "pika", "kana", "glénat", "kurokawa", "delcourt", "ki-oon", "soleil manga",
            "panini manga", "doki-doki", "akata", "meian", "vega", "tonkam", "casterman",
            "kazé", "nobi nobi", "komikku", "mangetsu", "bamboo", "kbooks", "taifu",
            "ototo", "urban comics", "kotoji", "kotori", "black box", "isan manga");

    private final GoogleBooksHttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GoogleBooksTitleSearchProvider(GoogleBooksHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Constructor used by the unit tests: parse() on a body
     * already in memory never needs a real network call. */
    GoogleBooksTitleSearchProvider() {
        this(new GoogleBooksHttpClient("", ""));
    }

    /** This provider searches precisely by FRENCH title - see the javadoc
     * of the method: it cannot be used to decide that a French title
     * is "in fact the title of another work". */
    @Override
    public boolean catalogsOriginalTitles() {
        return false;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        try {
            return searchOrThrow(query);
        } catch (QuotaExceededException e) {
            // Best-effort by nature (completes Jikan/MyAnimeList, never their
            // only source) - no user alarm needed here.
            log.warn("Google Books quota exceeded for the title search '{}'", query);
            return List.of();
        } catch (SourceUnavailableException e) {
            log.warn(e.getMessage());
            return List.of();
        }
    }

    @Override
    public List<MetadataCandidate> searchOrThrow(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String body = httpClient.get(SEARCH_URL.formatted(encodedQuery));
            return parse(body);
        } catch (QuotaExceededException | SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new SourceUnavailableException("Google Books title search failed for '" + query + "': " + e.getMessage(), e);
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<MetadataCandidate> candidates = new ArrayList<>();
        // A series often has several volumes indexed separately - a single
        // suggestion per series once the volume number is removed from the title.
        Set<String> seenTitles = new HashSet<>();

        for (JsonNode item : root.path("items")) {
            String id = item.path("id").asText(null);
            JsonNode volumeInfo = item.path("volumeInfo");
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue; // langRestrict is a preference, not a guarantee - we check again
            }
            String rawTitle = volumeInfo.path("title").asText(null);
            if (id == null || rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            String title = VOLUME_SUFFIX.matcher(rawTitle).replaceFirst("").trim();
            if (title.isBlank()) {
                continue;
            }

            // The publisher filter MUST come before the deduplication by series: Google
            // Books often returns the same cleaned title several times (one volume
            // per record), some records without a publisher field filled in
            // and others with - if the first occurrence met is filtered out
            // (no recognized publisher), the deduplication must not prevent a
            // following valid occurrence from passing (bug seen: a
            // "Tome 2" record without publisher "consumed" the series before a "T01" record
            // with publisher "Pika" had its chance).
            String publisher = volumeInfo.path("publisher").asText(null);
            if (!isKnownMangaPublisher(publisher) || !seenTitles.add(title.toLowerCase())) {
                continue;
            }

            Map<String, Object> attributes = new HashMap<>();
            JsonNode authors = volumeInfo.path("authors");
            if (authors.isArray() && !authors.isEmpty()) {
                attributes.put("mangaka", authors.get(0).asText(null));
            }
            attributes.put("publisher", publisher);

            String imageUrl = volumeInfo.path("imageLinks").path("thumbnail").asText(null);
            if (imageUrl != null) {
                imageUrl = imageUrl.replaceFirst("^http://", "https://");
            }

            candidates.add(new MetadataCandidate("GOOGLE_BOOKS", id, title, imageUrl, attributes));
        }
        return candidates;
    }

    private static boolean isKnownMangaPublisher(String publisher) {
        if (publisher == null || publisher.isBlank()) {
            return false;
        }
        String normalized = publisher.toLowerCase();
        return KNOWN_MANGA_PUBLISHERS.stream().anyMatch(normalized::contains);
    }
}
