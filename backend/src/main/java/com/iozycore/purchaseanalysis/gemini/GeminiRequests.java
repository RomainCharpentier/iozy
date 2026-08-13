package com.iozycore.purchaseanalysis.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Shared plumbing for the Gemini {@code generateContent} REST call - used
 * by both {@link GeminiEditionAdvisor} and {@link GeminiMarketPriceAdvisor}
 * so the request/response envelope (auth header, JSON response mode,
 * where the generated text lives in the response) is written once.
 */
final class GeminiRequests {

    /**
     * Free-tier-eligible as of 2026-08-13 (ai.google.dev/pricing) - kept here rather than in
     * application.yml because docker-compose.yml always sets GEMINI_MODEL in the container's
     * environment (even blank), so Spring's own "${GEMINI_MODEL:default}" placeholder default
     * never triggers (it only applies when the property is entirely absent, not present-but-blank).
     */
    private static final String DEFAULT_MODEL = "gemini-3.5-flash";

    private GeminiRequests() {
    }

    /** Resolves the configured model, falling back to {@link #DEFAULT_MODEL} when blank - see the field's javadoc. */
    static String effectiveModel(String configuredModel) {
        return configuredModel == null || configuredModel.isBlank() ? DEFAULT_MODEL : configuredModel;
    }

    private static String endpointFor(String model) {
        return "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    }

    static HttpResponse<String> send(HttpClient httpClient, ObjectMapper objectMapper, String apiKey, String model,
                                      String prompt) throws Exception {
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of("responseMimeType", "application/json", "temperature", 0.2)));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpointFor(effectiveModel(model))))
                .timeout(Duration.ofSeconds(20))
                .header("x-goog-api-key", apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    /** The model's raw text output (a JSON string, since generationConfig.responseMimeType asked for JSON) - null if absent. */
    static String extractText(ObjectMapper objectMapper, String generateContentResponseBody) throws Exception {
        JsonNode root = objectMapper.readTree(generateContentResponseBody);
        JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        return textNode.isMissingNode() || textNode.isNull() ? null : textNode.asText(null);
    }

    /** Truncated for logging - never let a verbose error body flood the logs. */
    static String snippet(String body) {
        if (body == null) {
            return "";
        }
        return body.substring(0, Math.min(300, body.length()));
    }
}
