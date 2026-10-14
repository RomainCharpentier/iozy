package com.iozycore.videogame.igdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Fetches the "similar" games of a specific IGDB game (similar_games field,
 * computed by IGDB itself) - unlike BGG, which has no direct
 * equivalent and needs to cross categories/mechanics through BggThingFetcher +
 * BggHotListFetcher, IGDB does the similarity work on the server side, so
 * a single call per owned game is enough for discovery (see DiscoveryService).
 */
@Component
@RequiredArgsConstructor
public class IgdbSimilarGamesFetcher {

    private static final String GAMES_URL = "https://api.igdb.com/v4/games";
    private static final String SIMILAR_GAMES_BODY =
            "fields similar_games.name,similar_games.cover.url; where id = %s;";

    @Value("${igdb.client-id:}")
    private String clientId;

    private final IgdbTokenProvider tokenProvider;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * @throws SourceUnavailableException when IGDB did not answer - never an
     *         empty list in that case, so that Discover can tell an outage from
     *         a game with no similar games
     */
    public List<MetadataCandidate> fetchSimilarGames(String igdbId) {
        try {
            String accessToken = tokenProvider.getAccessToken();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GAMES_URL))
                    .timeout(Duration.ofSeconds(8))
                    .header("Client-ID", clientId)
                    .header("Authorization", "Bearer " + accessToken)
                    .POST(HttpRequest.BodyPublishers.ofString(SIMILAR_GAMES_BODY.formatted(igdbId)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new SourceUnavailableException(
                        "IGDB answered " + response.statusCode() + " for /games?similar_games id=" + igdbId);
            }

            return parse(response.body());
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (IgdbUnavailableException e) {
            throw new SourceUnavailableException("IGDB unavailable for the games similar to id " + igdbId + ": " + e.getMessage(), e);
        } catch (Exception e) {
            throw new SourceUnavailableException("IGDB similar_games call failed for id " + igdbId + ": " + e.getMessage(), e);
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<MetadataCandidate> candidates = new ArrayList<>();

        // The query "where id = X" returns an array with a single element
        // (the source game), whose similar_games is the array we are interested in.
        for (JsonNode game : root) {
            for (JsonNode similar : game.path("similar_games")) {
                String similarId = similar.path("id").asText();
                String title = similar.path("name").asText();
                if (title.isBlank()) {
                    continue;
                }
                String imageUrl = normalizeCoverUrl(similar.path("cover").path("url").asText(null));
                candidates.add(new MetadataCandidate("IGDB", similarId, title, imageUrl, Map.of("igdbId", similarId)));
            }
        }
        return candidates;
    }

    private static String normalizeCoverUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }
        String withScheme = rawUrl.startsWith("//") ? "https:" + rawUrl : rawUrl;
        return withScheme.replace("t_thumb", "t_cover_big");
    }
}
