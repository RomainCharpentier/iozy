package com.iozycore.manga.metadata.googlebooks;

import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Point d'appel HTTP unique partagé par les 4 fournisseurs Google Books
 * (recherche de tomes, titre français par résolution, titre français direct,
 * lookup par code-barres) - centralise la rotation de clé API et la
 * détection du quota dépassé (429), auparavant dupliquées à l'identique dans
 * chacun des 4 fichiers.
 * <p>
 * Clé de secours (voir {@code google-books.backup-api-keys}, vérifié
 * manuellement : le quota par défaut de la clé principale s'est épuisé en
 * une session de tests intensifs) : quand une clé répond 429, on retente
 * immédiatement avec la suivante avant d'abandonner - chaque clé a son
 * propre quota journalier (projets Google Cloud distincts), donc une
 * deuxième clé double la capacité réelle sans changer le code appelant.
 * {@link QuotaExceededException} n'est levée que si TOUTES les clés
 * configurées (et l'appel anonyme si aucune clé) ont répondu 429.
 * <p>
 * Repli sur cooldown ({@link #isQuotaLikelyExhausted()}) : une fois le quota
 * de toutes les clés confirmé épuisé, on suppose qu'il le reste pendant
 * {@link #COOLDOWN} plutôt que de re-tenter (et re-consommer inutilement le
 * quota qui recommence à peine à se reconstituer) à chaque appel suivant -
 * {@link GoogleBooksVolumeSearchProvider} l'utilise pour réduire son
 * éventail de 8 requêtes à 1 seule tant que la fenêtre est active.
 */
@Component
public class GoogleBooksHttpClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksHttpClient.class);
    private static final Duration COOLDOWN = Duration.ofHours(1);

    private final List<String> apiKeys;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private volatile Instant quotaExceededUntil = Instant.EPOCH;

    public GoogleBooksHttpClient(
            @Value("${google-books.api-key:}") String primaryApiKey,
            @Value("${google-books.backup-api-keys:}") String backupApiKeys) {
        List<String> keys = new ArrayList<>();
        if (primaryApiKey != null && !primaryApiKey.isBlank()) {
            keys.add(primaryApiKey.trim());
        }
        if (backupApiKeys != null && !backupApiKeys.isBlank()) {
            for (String key : backupApiKeys.split(",")) {
                if (!key.isBlank()) {
                    keys.add(key.trim());
                }
            }
        }
        this.apiKeys = keys;
    }

    /** Vrai si un appel récent a confirmé le quota épuisé sur TOUTES les clés
     * (voir {@link #COOLDOWN}) - permet à un appelant de réduire son nombre
     * de requêtes plutôt que de toutes les gaspiller en échecs quasi certains. */
    public boolean isQuotaLikelyExhausted() {
        return Instant.now().isBefore(quotaExceededUntil);
    }

    /**
     * Envoie {@code urlWithoutKey} en essayant chaque clé API configurée dans
     * l'ordre (principale puis secours) jusqu'à une réponse 200 - passe à la
     * clé suivante uniquement sur 429 (quota dépassé), jamais sur une autre
     * erreur (400, 500...), qui ne serait pas résolue par une autre clé. Sans
     * clé configurée du tout, une seule requête anonyme est tentée (quota
     * mondial partagé Google).
     *
     * @return le corps de la réponse 200 - jamais {@code null} : un appel qui
     * n'aboutit pas LÈVE, pour que l'appelant ne puisse pas confondre « la
     * source n'a pas répondu » avec « la source a répondu, il n'y a rien »
     * (voir {@link SourceUnavailableException}).
     * @throws QuotaExceededException si toutes les clés essayées ont répondu 429.
     * @throws SourceUnavailableException sur tout autre échec : statut HTTP
     * inattendu, délai dépassé, coupure réseau.
     */
    public String get(String urlWithoutKey) {
        List<String> keysToTry = apiKeys.isEmpty() ? List.of("") : apiKeys;

        for (String key : keysToTry) {
            String url = key.isBlank() ? urlWithoutKey : urlWithoutKey + "&key=" + key;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response;
            try {
                response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            } catch (IOException e) {
                // Coupure réseau ou délai dépassé : la source n'a rien dit, ce
                // n'est PAS une absence de résultat (voir la javadoc).
                throw new SourceUnavailableException("Google Books injoignable pour '" + urlWithoutKey + "'", e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt(); // ne jamais avaler l'interruption
                throw new SourceUnavailableException("Appel Google Books interrompu pour '" + urlWithoutKey + "'", e);
            }
            if (response.statusCode() == 200) {
                return response.body();
            }
            if (response.statusCode() == 429) {
                log.warn("Google Books a répondu 429 (quota) - tentative de la clé suivante s'il y en a une");
                continue;
            }
            // Autre statut (503, 500, 400...) : changer de clé n'y changerait
            // rien, et surtout ce n'est pas une réponse - le distinguer d'une
            // liste vide évite de mettre en cache une panne (voir Lot 58).
            log.warn("Google Books a répondu {} pour '{}'", response.statusCode(), urlWithoutKey);
            throw new SourceUnavailableException(
                    "Google Books a répondu " + response.statusCode() + " pour '" + urlWithoutKey + "'");
        }

        // Seul chemin restant : chaque clé essayée a répondu 429.
        quotaExceededUntil = Instant.now().plus(COOLDOWN);
        throw new QuotaExceededException(
                "Quota Google Books dépassé sur les " + keysToTry.size() + " clé(s) essayée(s)");
    }
}
