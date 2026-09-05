package com.iozycore.manga.deals.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.manga.deals.AiEditionAdvisor;
import com.iozycore.insights.ConfidenceLevel;
import com.iozycore.manga.deals.EditionSuggestion;
import com.iozycore.manga.domain.EditionTier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;
import com.iozycore.gemini.GeminiRequests;

/**
 * Calls the Google Gemini API (ai.google.dev - genuinely free tier for
 * Flash/Flash-Lite models, no billing required, see project memory) to
 * draft {@link EditionSuggestion}s. Self-disabled (never calls out, always
 * returns empty) when {@code gemini.api-key} is blank - same convention as
 * {@code IgdbMetadataProvider}/{@code GoogleBooksHttpClient}: an absent key
 * simply means this capability is off, never an error surfaced to the user.
 */
@Component
public class GeminiEditionAdvisor implements AiEditionAdvisor {

    private static final Logger log = LoggerFactory.getLogger(GeminiEditionAdvisor.class);

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

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:}")
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
            HttpResponse<String> response = GeminiRequests.send(httpClient, objectMapper, apiKey, model,
                    PROMPT_TEMPLATE.formatted(seriesTitle, editionName));
            if (response.statusCode() != 200) {
                log.warn("Gemini ({}) a répondu {} pour l'édition '{}' / '{}' : {}", GeminiRequests.effectiveModel(model),
                        response.statusCode(), seriesTitle, editionName, GeminiRequests.snippet(response.body()));
                return Optional.empty();
            }
            return parseSuggestion(response.body());
        } catch (Exception e) {
            log.warn("Échec de l'appel à Gemini pour '{}' / '{}' : {}", seriesTitle, editionName, e.getMessage());
            return Optional.empty();
        }
    }

    /** Package-private for direct unit testing with a canned response body, bypassing HTTP. */
    Optional<EditionSuggestion> parseSuggestion(String generateContentResponseBody) throws Exception {
        String content = GeminiRequests.extractText(objectMapper, generateContentResponseBody);
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
