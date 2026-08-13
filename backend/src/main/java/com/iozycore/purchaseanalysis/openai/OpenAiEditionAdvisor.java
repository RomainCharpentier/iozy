package com.iozycore.purchaseanalysis.openai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.purchaseanalysis.AiEditionAdvisor;
import com.iozycore.purchaseanalysis.ConfidenceLevel;
import com.iozycore.purchaseanalysis.EditionSuggestion;
import com.iozycore.purchaseanalysis.EditionTier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Calls the OpenAI Chat Completions API (platform.openai.com - NOT the same
 * thing as a ChatGPT Plus subscription, which does not grant API access) to
 * draft {@link EditionSuggestion}s. Self-disabled (never calls out, always
 * returns empty) when {@code openai.api-key} is blank - same convention as
 * {@code IgdbMetadataProvider}/{@code GoogleBooksHttpClient}: an absent key
 * simply means this capability is off, never an error surfaced to the user.
 */
@Component
public class OpenAiEditionAdvisor implements AiEditionAdvisor {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEditionAdvisor.class);
    private static final String CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

    private static final String PROMPT_TEMPLATE = """
            Tu es un expert des éditions françaises de mangas. Pour la série "%s", édition "%s", \
            réponds UNIQUEMENT avec un objet JSON (aucun texte autour) avec exactement ces clés :
            {
              "totalVolumes": <nombre entier de tomes au total dans cette édition, ou null si tu ne sais pas>,
              "publisher": "<éditeur français, ou null>",
              "retailPriceNewPerVolume": <prix neuf éditeur en euros par tome, nombre, ou null>,
              "outOfPrint": <true si l'édition est épuisée/arrêtée, false si toujours éditée, null si tu ne sais pas>,
              "betterEditionAnnounced": <true si une meilleure édition de cette série a été annoncée depuis, sinon false, null si tu ne sais pas>,
              "betterEditionNote": "<courte précision si betterEditionAnnounced est true, sinon null>",
              "editionTier": "<une valeur parmi STANDARD, DELUXE, PRESTIGE, PERFECT, COLLECTOR, INTEGRAL, OTHER, ou null>",
              "confidence": "<HIGH, MEDIUM ou LOW - ton niveau de confiance global sur cette réponse>",
              "rationale": "<1-2 phrases en français expliquant l'estimation et ses limites>"
            }
            Règle impérative : ne JAMAIS inventer un chiffre plausible. Mets null pour tout champ dont tu n'es \
            pas raisonnablement certain plutôt que de deviner - une valeur absente est bien plus utile qu'une \
            valeur fausse ici.""";

    @Value("${openai.api-key:}")
    private String apiKey;

    @Value("${openai.model:gpt-4o-mini}")
    private String model;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Optional<EditionSuggestion> suggestReferenceData(String seriesTitle, String editionName) {
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        try {
            String requestBody = objectMapper.writeValueAsString(Map.of(
                    "model", model,
                    "response_format", Map.of("type", "json_object"),
                    "temperature", 0.2,
                    "messages", List.of(Map.of("role", "user",
                            "content", PROMPT_TEMPLATE.formatted(seriesTitle, editionName)))));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(CHAT_COMPLETIONS_URL))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                // Le corps d'erreur OpenAI (jamais la clé, seulement envoyée dans l'en-tête Authorization
                // de LA REQUÊTE) explique la cause exacte (quota/facturation vs rate-limit) - utile pour
                // diagnostiquer sans deviner, tronqué pour ne pas noyer les logs sur une réponse verbeuse.
                String bodySnippet = response.body() == null ? "" : response.body().substring(0, Math.min(300, response.body().length()));
                log.warn("OpenAI a répondu {} pour l'édition '{}' / '{}' : {}", response.statusCode(), seriesTitle, editionName, bodySnippet);
                return Optional.empty();
            }
            return parseSuggestion(response.body());
        } catch (Exception e) {
            log.warn("Échec de l'appel à OpenAI pour '{}' / '{}' : {}", seriesTitle, editionName, e.getMessage());
            return Optional.empty();
        }
    }

    /** Package-private for direct unit testing with a canned response body, bypassing HTTP - same pattern as IgdbMetadataProvider#parse. */
    Optional<EditionSuggestion> parseSuggestion(String chatCompletionResponseBody) throws Exception {
        JsonNode root = objectMapper.readTree(chatCompletionResponseBody);
        String content = root.path("choices").path(0).path("message").path("content").asText(null);
        if (content == null || content.isBlank()) {
            return Optional.empty();
        }

        JsonNode json = objectMapper.readTree(content);
        ConfidenceLevel confidence = parseEnum(ConfidenceLevel.class, json.path("confidence").asText(null), ConfidenceLevel.LOW);
        EditionTier tier = parseEnum(EditionTier.class, json.path("editionTier").asText(null), null);

        return Optional.of(new EditionSuggestion(
                tier,
                textOrNull(json, "publisher"),
                intOrNull(json, "totalVolumes"),
                decimalOrNull(json, "retailPriceNewPerVolume"),
                boolOrNull(json, "outOfPrint"),
                boolOrNull(json, "betterEditionAnnounced"),
                textOrNull(json, "betterEditionNote"),
                confidence,
                textOrNull(json, "rationale")));
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNull() || value.isMissingNode() ? null : value.asText(null);
    }

    private static Integer intOrNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNull() || value.isMissingNode() || !value.isNumber() ? null : value.asInt();
    }

    private static BigDecimal decimalOrNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNull() || value.isMissingNode() || !value.isNumber() ? null : BigDecimal.valueOf(value.asDouble());
    }

    private static Boolean boolOrNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNull() || value.isMissingNode() || !value.isBoolean() ? null : value.asBoolean();
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> enumType, String value, E fallbackWhenBlankOrInvalid) {
        if (value == null || value.isBlank()) {
            return fallbackWhenBlankOrInvalid;
        }
        try {
            return Enum.valueOf(enumType, value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return fallbackWhenBlankOrInvalid;
        }
    }
}
