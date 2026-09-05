package com.iozycore.core.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Shared plumbing for the Gemini {@code generateContent} REST call - used
 * by both {@link GeminiEditionAdvisor} and {@link GeminiMarketPriceAdvisor}
 * so the request/response envelope (auth header, JSON response mode,
 * where the generated text lives in the response) is written once.
 */
public final class GeminiRequests {

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
    public static String effectiveModel(String configuredModel) {
        return configuredModel == null || configuredModel.isBlank() ? DEFAULT_MODEL : configuredModel;
    }

    private static String endpointFor(String model) {
        return "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
    }

    public static HttpResponse<String> send(HttpClient httpClient, ObjectMapper objectMapper, String apiKey, String model,
                                      String prompt) throws Exception {
        return send(httpClient, objectMapper, apiKey, model, prompt, List.of(), Duration.ofSeconds(20));
    }

    /**
     * Une image à joindre au prompt. Gemini les attend en {@code inlineData},
     * encodées en base64, dans la même liste de {@code parts} que le texte.
     *
     * @param mediaType type MIME déjà validé par l'appelant
     * @param bytes     le contenu - <b>jamais journalisé</b>, ni ici ni ailleurs
     */
    public record InlineImage(String mediaType, byte[] bytes) {
    }

    /**
     * Variante multimodale : le même enveloppe, avec des images devant le
     * prompt. L'ordre compte - le modèle lit les parts dans l'ordre donné, et
     * poser les images d'abord puis la consigne donne de bien meilleurs
     * résultats que l'inverse.
     * <p>
     * Le délai est paramétrable parce qu'une requête portant plusieurs mégaoctets
     * d'images ne se compare pas à une question en texte : 20 secondes suffisent
     * à la seconde, pas à la première.
     */
    public static HttpResponse<String> send(HttpClient httpClient, ObjectMapper objectMapper, String apiKey, String model,
                                      String prompt, List<InlineImage> images, Duration timeout) throws Exception {
        List<Map<String, Object>> parts = new ArrayList<>();
        for (InlineImage image : images) {
            parts.add(Map.of("inline_data", Map.of(
                    "mime_type", image.mediaType(),
                    "data", Base64.getEncoder().encodeToString(image.bytes()))));
        }
        parts.add(Map.of("text", prompt));

        String requestBody = objectMapper.writeValueAsString(Map.of(
                "contents", List.of(Map.of("parts", parts)),
                "generationConfig", Map.of("responseMimeType", "application/json", "temperature", 0.2)));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpointFor(effectiveModel(model))))
                .timeout(timeout)
                .header("x-goog-api-key", apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    /** The model's raw text output (a JSON string, since generationConfig.responseMimeType asked for JSON) - null if absent. */
    public static String extractText(ObjectMapper objectMapper, String generateContentResponseBody) throws Exception {
        JsonNode root = objectMapper.readTree(generateContentResponseBody);
        JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        return textNode.isMissingNode() || textNode.isNull() ? null : textNode.asText(null);
    }

    /** Truncated for logging - never let a verbose error body flood the logs. */
    public static String snippet(String body) {
        if (body == null) {
            return "";
        }
        return body.substring(0, Math.min(300, body.length()));
    }
}
