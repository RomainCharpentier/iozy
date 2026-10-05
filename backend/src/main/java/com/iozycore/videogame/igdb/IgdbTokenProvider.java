package com.iozycore.videogame.igdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

/**
 * Gets and caches an IGDB access token through the Twitch OAuth2
 * client-credentials flow (IGDB belongs to Twitch/Amazon). Unlike
 * the BGG token (static, optional - see BggAuthorization),
 * this token expires (a few tens of days in practice on the Twitch side) and
 * must be renewed: this component is therefore stateful, with in-memory
 * state (single-user application, no need for a distributed cache).
 * <p>
 * IGDB has no degraded mode: without valid credentials, no IGDB call
 * can succeed (unlike BGG, which works without a token but is
 * not compliant with its terms).
 */
@Component
public class IgdbTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(IgdbTokenProvider.class);
    private static final String TOKEN_URL =
            "https://id.twitch.tv/oauth2/token?client_id=%s&client_secret=%s&grant_type=client_credentials";
    // Safety margin to never hand over a token about to expire
    // to a caller that would use it right after (network latency included).
    private static final long EXPIRY_SAFETY_MARGIN_SECONDS = 60;

    @Value("${igdb.client-id:}")
    private String clientId;

    @Value("${igdb.client-secret:}")
    private String clientSecret;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private volatile String cachedToken;
    private volatile Instant cachedExpiresAt;

    /** Returns a valid access token, renewing it if missing/expired. */
    synchronized String getAccessToken() throws IgdbUnavailableException {
        if (!isExpired(cachedExpiresAt, Instant.now())) {
            return cachedToken;
        }
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IgdbUnavailableException(
                    "igdb.client-id/igdb.client-secret non configurés (IGDB_CLIENT_ID/IGDB_CLIENT_SECRET) - "
                            + "voir README.md, section \"Obtenir et configurer des identifiants IGDB/Twitch\"");
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(TOKEN_URL.formatted(clientId, clientSecret)))
                    .timeout(Duration.ofSeconds(8))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IgdbUnavailableException(
                        "Twitch a répondu " + response.statusCode() + " à l'échange de token IGDB");
            }

            JsonNode root = objectMapper.readTree(response.body());
            String accessToken = root.path("access_token").asText(null);
            long expiresIn = root.path("expires_in").asLong(0);
            if (accessToken == null || accessToken.isBlank()) {
                throw new IgdbUnavailableException("Réponse Twitch sans access_token exploitable");
            }

            cachedToken = accessToken;
            cachedExpiresAt = Instant.now().plusSeconds(expiresIn);
            return cachedToken;
        } catch (IgdbUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.warn("IGDB/Twitch token exchange failed: {}", e.getMessage());
            throw new IgdbUnavailableException("Échec de l'échange de token IGDB/Twitch", e);
        }
    }

    /** Expiry logic isolated in a pure static method - testable without a network call. */
    static boolean isExpired(Instant expiresAt, Instant now) {
        return expiresAt == null || !now.isBefore(expiresAt.minusSeconds(EXPIRY_SAFETY_MARGIN_SECONDS));
    }
}
