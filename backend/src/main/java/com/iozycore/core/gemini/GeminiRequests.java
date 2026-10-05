package com.iozycore.core.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
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

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(GeminiRequests.class);

    /** The statuses that say "try again": model overloaded (503) or per-minute quota (429). */
    static final java.util.Set<Integer> A_REESSAYER = java.util.Set.of(429, 503);

    /** Three attempts at most, 1.5 s then 3 s of waiting between them. */
    static final int TENTATIVES_MAX = 3;
    static final long PAUSE_INITIALE_MS = 1500;

    private GeminiRequests() {
    }

    /** A send that can throw - the signature of {@code HttpClient.send}. */
    interface Envoi {
        HttpResponse<String> executer() throws Exception;
    }

    /**
     * Retries when Google says to retry.
     *
     * <p>"This model is currently experiencing high demand. Spikes in demand
     * are usually temporary. Please try again later." - a 503 of this kind
     * rarely lasts more than a few seconds. Seen on 2026-09-15 on the
     * user's first shelf photo: the reading had failed outright,
     * while the same request went through fifteen seconds later. One
     * retry or two, with a short wait, avoid returning "could not
     * complete" for an incident that nobody would have seen. Any other
     * status is returned as is: a 400 or a 401 will not change by
     * waiting.
     */
    static HttpResponse<String> avecReprises(Envoi envoi, long pauseInitialeMs) throws Exception {
        HttpResponse<String> reponse = envoi.executer();
        long pause = pauseInitialeMs;
        for (int tentative = 2; tentative <= TENTATIVES_MAX && A_REESSAYER.contains(reponse.statusCode()); tentative++) {
            log.warn("Gemini answered {} - new attempt ({}/{}) in {} ms", reponse.statusCode(), tentative,
                    TENTATIVES_MAX, pause);
            Thread.sleep(pause);
            pause *= 2;
            reponse = envoi.executer();
        }
        return reponse;
    }

    /** The fallback when the main model is overloaded: the "lite" variant of the same generation, less in demand. */
    static final String DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

    /** A send to a given model - the same request, another address. */
    interface EnvoiParModele {
        HttpResponse<String> executer(String modele) throws Exception;
    }

    /**
     * The main model first, with its retries; if it stays overloaded (503)
     * or does not answer in time, the fallback, once. A 429 is not retried
     * elsewhere: a reached quota holds for the key, not for a model. Without a
     * fallback, the answer of the main model is returned as is and an exceeded
     * time limit comes up as before.
     */
    static HttpResponse<String> avecRepli(EnvoiParModele envoi, String principal, String repli) throws Exception {
        HttpResponse<String> reponse;
        try {
            reponse = envoi.executer(principal);
        } catch (HttpTimeoutException e) {
            if (repli == null) {
                throw e;
            }
            log.warn("Gemini ({}) did not answer in time - falling back to {}", principal, repli);
            return envoi.executer(repli);
        }
        if (reponse.statusCode() == 503 && repli != null) {
            log.warn("Gemini ({}) stays overloaded after the retries - falling back to {}", principal, repli);
            return envoi.executer(repli);
        }
        return reponse;
    }

    /** The effective fallback: the configured one, otherwise {@link #DEFAULT_FALLBACK_MODEL}; none if it is the main one. */
    static String effectiveFallbackModel(String configured, String principal) {
        String repli = configured == null || configured.isBlank() ? DEFAULT_FALLBACK_MODEL : configured.trim();
        return repli.equals(principal) ? null : repli;
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
     * An image to attach to the prompt. Gemini expects them as {@code inlineData},
     * encoded in base64, in the same {@code parts} list as the text.
     *
     * @param mediaType MIME type already validated by the caller
     * @param bytes     the content - <b>never logged</b>, neither here nor elsewhere
     */
    public record InlineImage(String mediaType, byte[] bytes) {
    }

    /**
     * Multimodal variant: the same envelope, with images in front of the
     * prompt. Order matters - the model reads the parts in the given order, and
     * putting the images first then the instruction gives much better
     * results than the opposite.
     * <p>
     * The timeout is configurable because a request carrying several megabytes
     * of images cannot be compared to a text question: 20 seconds are enough
     * for the second, not for the first.
     */
    public static HttpResponse<String> send(HttpClient httpClient, ObjectMapper objectMapper, String apiKey, String model,
                                      String prompt, List<InlineImage> images, Duration timeout) throws Exception {
        return send(httpClient, objectMapper, apiKey, model, null, prompt, images, timeout);
    }

    /**
     * The same envelope, with a fallback model: when the main model
     * stays overloaded after the retries (503) or does not answer in time, the same
     * request goes out once more to {@code fallbackModel} - by default the
     * "lite" variant of the same generation, less in demand. Seen on
     * the evening of 2026-09-16: gemini-3.5-flash no longer answered at all while
     * gemini-3.5-flash-lite answered in one second.
     */
    public static HttpResponse<String> send(HttpClient httpClient, ObjectMapper objectMapper, String apiKey, String model,
                                      String fallbackModel, String prompt, List<InlineImage> images,
                                      Duration timeout) throws Exception {
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

        String principal = effectiveModel(model);
        String repli = effectiveFallbackModel(fallbackModel, principal);
        // The body is a string: the same request is sent again as is,
        // to the main model then, if needed, to the fallback.
        return avecRepli(modele -> avecReprises(() -> httpClient.send(
                        requete(apiKey, modele, requestBody, timeout), HttpResponse.BodyHandlers.ofString()),
                PAUSE_INITIALE_MS), principal, repli);
    }

    private static HttpRequest requete(String apiKey, String modele, String requestBody, Duration timeout) {
        return HttpRequest.newBuilder()
                .uri(URI.create(endpointFor(modele)))
                .timeout(timeout)
                .header("x-goog-api-key", apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();
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
