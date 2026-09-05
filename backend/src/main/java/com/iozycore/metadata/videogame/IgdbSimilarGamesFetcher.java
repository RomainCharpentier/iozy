package com.iozycore.metadata.videogame;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.metadata.MetadataCandidate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * Récupère les jeux "similaires" à un jeu IGDB précis (champ similar_games,
 * calculé par IGDB lui-même) - contrairement à BGG qui n'a pas d'équivalent
 * direct et nécessite de croiser catégories/mécaniques via BggThingFetcher +
 * BggHotListFetcher, IGDB fait le travail de similarité côté serveur, donc
 * un seul appel par jeu possédé suffit à la découverte (voir DiscoveryService).
 */
@Component
public class IgdbSimilarGamesFetcher {

    private static final Logger log = LoggerFactory.getLogger(IgdbSimilarGamesFetcher.class);
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

    public IgdbSimilarGamesFetcher(IgdbTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

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
                log.warn("IGDB a répondu {} pour /games?similar_games id={}", response.statusCode(), igdbId);
                return List.of();
            }

            return parse(response.body());
        } catch (IgdbUnavailableException e) {
            log.warn("IGDB indisponible pour les jeux similaires à l'id {} : {}", igdbId, e.getMessage());
            return List.of();
        } catch (Exception e) {
            log.warn("Échec de l'appel IGDB similar_games pour l'id {} : {}", igdbId, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<MetadataCandidate> candidates = new ArrayList<>();

        // La requête "where id = X" renvoie un tableau à un seul élément
        // (le jeu source), dont similar_games est le tableau qui nous intéresse.
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
