package com.iozycore.manga.metadata.googlebooks;

import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import lombok.extern.slf4j.Slf4j;
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
 * Single HTTP call point shared by the 4 Google Books providers
 * (volume search, French title by resolution, direct French title,
 * barcode lookup) - centralizes the API key rotation and the
 * detection of the exceeded quota (429), previously duplicated identically in
 * each of the 4 files.
 * <p>
 * Backup key (see {@code google-books.backup-api-keys}, checked
 * manually: the default quota of the main key ran out in
 * one session of intensive tests): when a key answers 429, we retry
 * immediately with the next one before giving up - each key has its
 * own daily quota (distinct Google Cloud projects), so a
 * second key doubles the real capacity without changing the calling code.
 * {@link QuotaExceededException} is only thrown if ALL the configured
 * keys (and the anonymous call if no key) answered 429.
 * <p>
 * Fallback on cooldown ({@link #isQuotaLikelyExhausted()}): once the quota
 * of all keys is confirmed exhausted, we assume it stays so for
 * {@link #COOLDOWN} instead of retrying (and needlessly consuming again the
 * quota that is just starting to build up again) at each following call -
 * {@link GoogleBooksVolumeSearchProvider} uses it to reduce its
 * fan-out from 8 requests to a single one while the window is active.
 */
@Component
@Slf4j
public class GoogleBooksHttpClient {

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

    /** True if a recent call confirmed the quota exhausted on ALL keys
     * (see {@link #COOLDOWN}) - allows a caller to reduce its number
     * of requests instead of wasting all of them on almost certain failures. */
    public boolean isQuotaLikelyExhausted() {
        return Instant.now().isBefore(quotaExceededUntil);
    }

    /**
     * Sends {@code urlWithoutKey} by trying each configured API key in
     * order (main then backup) until a 200 answer - moves to the
     * next key only on 429 (quota exceeded), never on another
     * error (400, 500...), which another key would not solve. Without any
     * key configured, a single anonymous request is tried (shared
     * Google worldwide quota).
     *
     * @return the body of the 200 answer - never {@code null}: a call that
     * does not succeed THROWS, so that the caller cannot confuse "the
     * source did not answer" with "the source answered, there is nothing"
     * (see {@link SourceUnavailableException}).
     * @throws QuotaExceededException if all the keys tried answered 429.
     * @throws SourceUnavailableException on any other failure: unexpected HTTP
     * status, timeout, network cut.
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
                // Network cut or timeout: the source said nothing, it
                // is NOT an absence of result (see the javadoc).
                throw new SourceUnavailableException("Google Books injoignable pour '" + urlWithoutKey + "'", e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt(); // never swallow the interruption
                throw new SourceUnavailableException("Appel Google Books interrompu pour '" + urlWithoutKey + "'", e);
            }
            if (response.statusCode() == 200) {
                return response.body();
            }
            if (response.statusCode() == 429) {
                log.warn("Google Books answered 429 (quota) - trying the next key if there is one");
                continue;
            }
            // Other status (503, 500, 400...): changing key would change
            // nothing, and above all it is not an answer - telling it apart from an
            // empty list avoids caching an outage (see Batch 58).
            log.warn("Google Books answered {} for '{}'", response.statusCode(), urlWithoutKey);
            throw new SourceUnavailableException(
                    "Google Books a répondu " + response.statusCode() + " pour '" + urlWithoutKey + "'");
        }

        // Only remaining path: each key tried answered 429.
        quotaExceededUntil = Instant.now().plus(COOLDOWN);
        throw new QuotaExceededException(
                "Quota Google Books dépassé sur les " + keysToTry.size() + " clé(s) essayée(s)");
    }
}
