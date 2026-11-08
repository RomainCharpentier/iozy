package com.iozycore.videogame.igdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.videogame.franchise.Franchise;
import com.iozycore.videogame.franchise.FranchiseGame;
import com.iozycore.videogame.franchise.FranchiseSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The licence of a game on IGDB: its collections (the series, "The Legend of
 * Zelda") and its franchises, then every game of them.
 *
 * <p>Two calls per game: the game itself for its collections and franchises,
 * then their games with cover, consoles and first release. Only the games
 * themselves are kept: no DLC, bundle, season, update or edition of another
 * game ({@code parent_game}, {@code version_parent}, {@code game_type}).
 *
 * <p>Only called by the background job ({@code VideoGameFranchiseBackfill}),
 * never while a page is read; never without the IGDB key.
 */
@Component
public class IgdbFranchiseFetcher implements FranchiseSource {

    private static final String GAMES_URL = "https://api.igdb.com/v4/games";
    private static final String GAME_BODY = "fields collections.name,franchises.name; where id = %s; limit 1;";
    private static final String MEMBERS_BODY = "fields name,cover.url,platforms.name,first_release_date,game_type,"
            + "category,parent_game,version_parent; where %s & parent_game = null & version_parent = null; "
            + "sort first_release_date asc; limit 200;";
    /** Main game, standalone expansion, remake, remaster, expanded game, port (IGDB game types). */
    private static final Set<Integer> GAME_TYPES_KEPT = Set.of(0, 4, 8, 9, 10, 11);

    @Value("${igdb.client-id:}")
    private String clientId;

    private final IgdbTokenProvider tokenProvider;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public IgdbFranchiseFetcher(IgdbTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    public boolean configured() {
        return tokenProvider.isConfigured();
    }

    @Override
    public Franchise franchiseOf(String igdbId) {
        if (!igdbId.matches("\\d+")) {
            return new Franchise(null, List.of());
        }
        Groups groups = parseGroups(post(GAME_BODY.formatted(igdbId)));
        if (groups.isEmpty()) {
            return new Franchise(null, List.of());
        }
        return new Franchise(groups.name(), parseGames(post(MEMBERS_BODY.formatted(groups.where()))));
    }

    private String post(String body) {
        try {
            String accessToken = tokenProvider.getAccessToken();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GAMES_URL))
                    .timeout(Duration.ofSeconds(10))
                    .header("Client-ID", clientId)
                    .header("Authorization", "Bearer " + accessToken)
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new SourceUnavailableException("IGDB answered " + response.statusCode() + " for a licence");
            }
            return response.body();
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (IgdbUnavailableException e) {
            throw new SourceUnavailableException("IGDB unavailable for a licence: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SourceUnavailableException("IGDB licence call interrupted", e);
        } catch (Exception e) {
            throw new SourceUnavailableException("IGDB licence call failed: " + e.getMessage(), e);
        }
    }

    /** The collections and franchises of a game; the collection names the licence first (it is the series). */
    record Groups(Map<String, String> collections, Map<String, String> franchises) {

        boolean isEmpty() {
            return collections.isEmpty() && franchises.isEmpty();
        }

        String name() {
            return collections.values().stream().filter(Objects::nonNull).findFirst()
                    .or(() -> franchises.values().stream().filter(Objects::nonNull).findFirst())
                    .orElse(null);
        }

        String where() {
            List<String> parts = new ArrayList<>();
            if (!collections.isEmpty()) {
                parts.add("collections = (" + String.join(",", collections.keySet()) + ")");
            }
            if (!franchises.isEmpty()) {
                parts.add("franchises = (" + String.join(",", franchises.keySet()) + ")");
            }
            return "(" + String.join(" | ", parts) + ")";
        }
    }

    /**
     * Only a JSON array is an IGDB answer: an empty array means a game IGDB does
     * not know (no licence, stored as such). An object (an error body) or text
     * that is not JSON is no answer: it throws and nothing is stored.
     */
    static JsonNode answer(String body) {
        JsonNode root;
        try {
            root = MAPPER.readTree(body);
        } catch (Exception e) {
            throw new SourceUnavailableException("Unreadable IGDB licence response: " + e.getMessage(), e);
        }
        if (root == null || !root.isArray()) {
            throw new SourceUnavailableException("IGDB licence response is not a list");
        }
        return root;
    }

    static Groups parseGroups(String body) {
        JsonNode root = answer(body);
        Map<String, String> collections = new LinkedHashMap<>();
        Map<String, String> franchises = new LinkedHashMap<>();
        for (JsonNode game : root) {
            readGroups(game.path("collections"), collections);
            readGroups(game.path("franchises"), franchises);
        }
        return new Groups(collections, franchises);
    }

    private static void readGroups(JsonNode groups, Map<String, String> into) {
        for (JsonNode group : groups) {
            String id = group.path("id").asText("");
            if (id.matches("\\d+")) {
                into.putIfAbsent(id, group.path("name").asText("").isBlank() ? null : group.path("name").asText());
            }
        }
    }

    static List<FranchiseGame> parseGames(String body) {
        JsonNode root = answer(body);
        List<FranchiseGame> games = new ArrayList<>();
        for (JsonNode game : root) {
            String id = game.path("id").asText("");
            String name = game.path("name").asText("").trim();
            if (id.isEmpty() || name.isEmpty() || !kept(game)) {
                continue;
            }
            List<String> platforms = new ArrayList<>();
            for (JsonNode platform : game.path("platforms")) {
                String platformName = platform.path("name").asText("").trim();
                if (!platformName.isEmpty()) {
                    platforms.add(platformName);
                }
            }
            String releaseDate = game.hasNonNull("first_release_date")
                    ? Instant.ofEpochSecond(game.path("first_release_date").asLong())
                    .atZone(ZoneOffset.UTC).toLocalDate().toString()
                    : null;
            games.add(new FranchiseGame(id, name, coverUrl(game.path("cover").path("url").asText(null)),
                    platforms, releaseDate));
        }
        return games.stream().collect(Collectors.toMap(FranchiseGame::igdbId, g -> g, (a, b) -> a,
                LinkedHashMap::new)).values().stream().toList();
    }

    /** A game type left out (DLC, bundle, episode...) is dropped; an answer without type is kept. */
    private static boolean kept(JsonNode game) {
        JsonNode type = game.has("game_type") ? game.path("game_type") : game.path("category");
        if (type.isMissingNode() || type.isNull()) {
            return true;
        }
        int value = type.isObject() ? type.path("id").asInt(0) : type.asInt(0);
        return GAME_TYPES_KEPT.contains(value);
    }

    private static String coverUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }
        String withScheme = rawUrl.startsWith("//") ? "https:" + rawUrl : rawUrl;
        return withScheme.replace("t_thumb", "t_cover_big");
    }
}
