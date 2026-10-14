package com.iozycore.manga.metadata.anilist;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.SourceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The MAIN provider for manga search: AniList
 * (anilist.co), a database of works - not a reading site -
 * with a public GraphQL API, no key, 90 requests per minute per
 * address, no daily quota.
 *
 * <h2>Why first</h2>
 * Born on 2026-09-04 as a backup, when Jikan answered 504 and Google Books
 * 429 at the same time; moved to the front the same day, on a rule given by
 * the user: <b>put forward the source that has the most calls
 * available</b>, so that the works of the application come from the same
 * place and carry the same data (Batch 119). Jikan is limited to 60
 * requests per minute and blocks from time to time, the official MyAnimeList
 * API asks for a key, Google Books has a daily quota; AniList
 * has no key and no daily quota. The three others stay behind (2, 3, 4):
 * the deduplication by title keeps the first candidate met, so
 * its own when it answers, theirs when it is silent.
 *
 * <p>It returns title, year, status, number of volumes, author, cover and
 * the MyAnimeList id ({@code idMal}), under the same attribute keys
 * as Jikan: the French title resolution and the volume search see
 * no difference. It does not know French titles: this
 * part stays with Open Library and Google Books, and the volumes with the BnF.
 */
@Component
@Order(1)
public class AniListMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(AniListMetadataProvider.class);

    private static final String ENDPOINT = "https://graphql.anilist.co";
    private static final String QUERY = """
            query ($q: String) {
              Page(perPage: 10) {
                media(search: $q, type: MANGA, sort: [POPULARITY_DESC]) {
                  id idMal format status volumes
                  startDate { year }
                  title { romaji english native }
                  coverImage { large }
                  staff(perPage: 6) { edges { role node { name { full } } } }
                }
              }
            }""";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        try {
            return searchOrThrow(query);
        } catch (SourceUnavailableException e) {
            log.warn(e.getMessage());
            return List.of();
        }
    }

    @Override
    public List<MetadataCandidate> searchOrThrow(String query) {
        try {
            String body = objectMapper.writeValueAsString(Map.of("query", QUERY, "variables", Map.of("q", query)));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ENDPOINT))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new SourceUnavailableException("AniList answered " + response.statusCode() + " for the query '" + query + "'");
            }
            return parse(response.body());
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new SourceUnavailableException("AniList call failed for '" + query + "': " + e.getMessage(), e);
        }
    }

    /** Package-private for the tests: an answer already in memory, without HTTP. */
    List<MetadataCandidate> parse(String body) throws Exception {
        List<MetadataCandidate> candidates = new ArrayList<>();
        for (JsonNode media : objectMapper.readTree(body).path("data").path("Page").path("media")) {
            String id = media.path("id").asText(null);
            JsonNode titles = media.path("title");
            String romaji = lisible(texte(titles, "romaji"));
            String english = lisible(texte(titles, "english"));
            String title = romaji != null ? romaji : english;
            if (id == null || title == null) {
                continue;
            }
            // Same keys as Jikan (see JikanMetadataProvider.parse): everything
            // that reads a candidate - subtitle of the list, French title
            // resolution, volume search - finds them in their place.
            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("mediaType", libelleFormat(media.path("format").asText(null)));
            attrs.put("titleRomaji", title);
            if (english != null) {
                attrs.put("titleEnglish", english);
            }
            String natif = texte(titles, "native");
            if (natif != null) {
                attrs.put("titleJapanese", natif);
                attrs.put("originalTitle", natif);
            }
            if (media.path("startDate").path("year").isNumber()) {
                attrs.put("startYear", String.valueOf(media.path("startDate").path("year").asInt()));
            }
            String status = media.path("status").asText(null);
            if (status != null) {
                attrs.put("seriesStatus", status);
            }
            if (media.path("volumes").isNumber()) {
                attrs.put("totalVolumes", media.path("volumes").asInt());
            }
            if (media.path("idMal").isNumber()) {
                attrs.put("malId", media.path("idMal").asText());
            }
            String mangaka = mangaka(media.path("staff").path("edges"));
            if (mangaka != null) {
                attrs.put("mangaka", mangaka);
            }
            String imageUrl = texte(media.path("coverImage"), "large");
            candidates.add(new MetadataCandidate("ANILIST", id, title, imageUrl, attrs));
        }
        return candidates;
    }

    /**
     * The author in the sense of Jikan (a single name): who does the story AND the
     * drawing first, then the story alone, then the drawing - never the
     * "original creator" of a derived work, who did not write this book.
     */
    private static String mangaka(JsonNode edges) {
        String[] priorites = {"Story & Art", "Story", "Art", "Illustration"};
        for (String role : priorites) {
            for (JsonNode edge : edges) {
                String r = edge.path("role").asText("");
                if (r.startsWith(role)) {
                    String nom = edge.path("node").path("name").path("full").asText(null);
                    if (nom != null && !nom.isBlank()) {
                        return nom;
                    }
                }
            }
        }
        return null;
    }

    /** The vocabulary of Jikan ("Manga", "Light Novel", "One-shot"), for a uniform subtitle in the list. */
    private static String libelleFormat(String format) {
        if (format == null) {
            return "Manga";
        }
        return switch (format) {
            case "NOVEL" -> "Light Novel";
            case "ONE_SHOT" -> "One-shot";
            default -> "Manga";
        };
    }

    /**
     * AniList sometimes takes the styling of the publisher, all in capitals
     * ("BORUTO: NARUTO NEXT GENERATIONS") where MyAnimeList writes "Boruto:
     * Naruto Next Generations". A title WITHOUT any lowercase letter is put back in
     * title case - the others are not touched, an isolated capital
     * possibly being intended ("JoJo").
     */
    static String lisible(String titre) {
        if (titre == null || titre.chars().anyMatch(Character::isLowerCase)
                || titre.chars().noneMatch(Character::isLetter)) {
            return titre;
        }
        StringBuilder sb = new StringBuilder(titre.length());
        boolean debutDeMot = true;
        for (char c : titre.toCharArray()) {
            if (Character.isLetter(c)) {
                sb.append(debutDeMot ? Character.toUpperCase(c) : Character.toLowerCase(c));
                debutDeMot = false;
            } else {
                sb.append(c);
                debutDeMot = !Character.isDigit(c);
            }
        }
        return sb.toString();
    }

    private static String texte(JsonNode node, String champ) {
        String v = node.path(champ).asText(null);
        return v == null || v.isBlank() ? null : v;
    }
}
