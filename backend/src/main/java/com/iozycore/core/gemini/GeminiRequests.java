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

    /** Les statuts qui disent « réessaie » : modèle saturé (503) ou quota de la minute (429). */
    static final java.util.Set<Integer> A_REESSAYER = java.util.Set.of(429, 503);

    /** Trois tentatives au plus, 1,5 s puis 3 s d'attente entre elles. */
    static final int TENTATIVES_MAX = 3;
    static final long PAUSE_INITIALE_MS = 1500;

    private GeminiRequests() {
    }

    /** Un envoi qui peut lever - la signature de {@code HttpClient.send}. */
    interface Envoi {
        HttpResponse<String> executer() throws Exception;
    }

    /**
     * Réessaie quand Google dit de réessayer.
     *
     * <p>« This model is currently experiencing high demand. Spikes in demand
     * are usually temporary. Please try again later. » - un 503 de ce genre
     * dure rarement plus de quelques secondes. Constaté le 2026-09-15 sur la
     * première photo d'étagère de l'utilisateur : la lecture avait échoué net,
     * alors que la même requête passait quinze secondes plus tard. Une
     * reprise ou deux, avec une courte attente, évitent de rendre « n'a pas
     * pu aboutir » pour un incident que personne n'aurait vu. Tout autre
     * statut est rendu tel quel : un 400 ou un 401 ne changera pas en
     * attendant.
     */
    static HttpResponse<String> avecReprises(Envoi envoi, long pauseInitialeMs) throws Exception {
        HttpResponse<String> reponse = envoi.executer();
        long pause = pauseInitialeMs;
        for (int tentative = 2; tentative <= TENTATIVES_MAX && A_REESSAYER.contains(reponse.statusCode()); tentative++) {
            log.warn("Gemini a répondu {} - nouvelle tentative ({}/{}) dans {} ms", reponse.statusCode(), tentative,
                    TENTATIVES_MAX, pause);
            Thread.sleep(pause);
            pause *= 2;
            reponse = envoi.executer();
        }
        return reponse;
    }

    /** Le repli quand le modèle principal sature : la variante « lite » de la même génération, moins demandée. */
    static final String DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

    /** Un envoi vers un modèle donné - la même requête, une autre adresse. */
    interface EnvoiParModele {
        HttpResponse<String> executer(String modele) throws Exception;
    }

    /**
     * Le modèle principal d'abord, avec ses reprises ; s'il reste saturé (503)
     * ou ne répond pas à temps, le repli, une fois. Un 429 n'est pas repris
     * ailleurs : un quota atteint vaut pour la clé, pas pour un modèle. Sans
     * repli, la réponse du principal est rendue telle quelle et un délai
     * dépassé remonte comme avant.
     */
    static HttpResponse<String> avecRepli(EnvoiParModele envoi, String principal, String repli) throws Exception {
        HttpResponse<String> reponse;
        try {
            reponse = envoi.executer(principal);
        } catch (HttpTimeoutException e) {
            if (repli == null) {
                throw e;
            }
            log.warn("Gemini ({}) n'a pas répondu à temps - repli sur {}", principal, repli);
            return envoi.executer(repli);
        }
        if (reponse.statusCode() == 503 && repli != null) {
            log.warn("Gemini ({}) reste saturé après les reprises - repli sur {}", principal, repli);
            return envoi.executer(repli);
        }
        return reponse;
    }

    /** Le repli effectif : le configuré, sinon {@link #DEFAULT_FALLBACK_MODEL} ; aucun s'il est le principal. */
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
        return send(httpClient, objectMapper, apiKey, model, null, prompt, images, timeout);
    }

    /**
     * La même enveloppe, avec un modèle de repli : quand le modèle principal
     * reste saturé après les reprises (503) ou ne répond pas à temps, la même
     * requête repart une fois vers {@code fallbackModel} - par défaut la
     * variante « lite » de la même génération, moins demandée. Constaté le
     * 2026-09-16 au soir : gemini-3.5-flash ne répondait plus du tout pendant
     * que gemini-3.5-flash-lite répondait en une seconde.
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
        // Le corps est une chaîne : la même requête se renvoie telle quelle,
        // vers le modèle principal puis, s'il le faut, vers le repli.
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
