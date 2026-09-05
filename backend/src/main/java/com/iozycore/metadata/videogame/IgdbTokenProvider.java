package com.iozycore.metadata.videogame;

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
 * Obtient et met en cache un access token IGDB via le flux OAuth2
 * client-credentials de Twitch (IGDB appartient à Twitch/Amazon). À la
 * différence du token BGG (statique, optionnel - voir BggAuthorization),
 * ce token expire (quelques dizaines de jours en pratique côté Twitch) et
 * doit être renouvelé : ce composant est donc stateful, avec état en
 * mémoire (application mono-utilisateur, pas besoin de cache distribué).
 * <p>
 * IGDB n'a pas de mode dégradé : sans identifiants valides, aucun appel
 * IGDB ne peut aboutir (contrairement à BGG, fonctionnel sans token mais
 * non conforme à ses conditions).
 */
@Component
public class IgdbTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(IgdbTokenProvider.class);
    private static final String TOKEN_URL =
            "https://id.twitch.tv/oauth2/token?client_id=%s&client_secret=%s&grant_type=client_credentials";
    // Marge de sécurité pour ne jamais remettre un token sur le point d'expirer
    // à un appelant qui l'utiliserait juste après (latence réseau incluse).
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

    /** Renvoie un access token valide, en le renouvelant si absent/expiré. */
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
            log.warn("Échec de l'échange de token IGDB/Twitch : {}", e.getMessage());
            throw new IgdbUnavailableException("Échec de l'échange de token IGDB/Twitch", e);
        }
    }

    /** Logique d'expiration isolée en méthode statique pure - testable sans appel réseau. */
    static boolean isExpired(Instant expiresAt, Instant now) {
        return expiresAt == null || !now.isBefore(expiresAt.minusSeconds(EXPIRY_SAFETY_MARGIN_SECONDS));
    }
}
