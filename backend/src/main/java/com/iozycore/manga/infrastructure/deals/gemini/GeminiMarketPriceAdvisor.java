package com.iozycore.manga.infrastructure.deals.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.manga.domain.deals.AiMarketPriceAdvisor;
import com.iozycore.manga.domain.deals.AiPriceEstimate;
import com.iozycore.manga.domain.deals.Condition;
import com.iozycore.manga.domain.deals.ConfidenceLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;
import com.iozycore.core.gemini.GeminiRequests;

/**
 * Calls the Google Gemini API to estimate a current second-hand per-volume
 * market price, for use only when no real {@link
 * com.iozycore.manga.domain.deals.MarketPriceObservation} exists yet (see
 * {@link AiMarketPriceAdvisor}). Self-disabled (never calls out, always
 * returns empty) when {@code gemini.api-key} is blank - same convention as
 * {@link GeminiEditionAdvisor}.
 */
@Component
@Slf4j
public class GeminiMarketPriceAdvisor implements AiMarketPriceAdvisor {

    private static final String PROMPT_TEMPLATE = """
            Tu es un expert du marché de l'occasion des mangas en France (Vinted, Leboncoin, forums de collectionneurs). \
            Pour la série "%s", édition "%s", un tome en état "%s" (échelle interne, du plus proche du neuf au plus abîmé : \
            MINT_SEALED, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE, VISIBLE_DEFECTS), réponds UNIQUEMENT avec un objet JSON \
            (aucun texte autour) avec exactement ces clés :
            {
              "pricePerVolume": <prix de revente d'occasion réaliste en euros pour UN tome dans cet état précis, nombre, ou null si tu ne sais pas>,
              "confidence": "<HIGH, MEDIUM ou LOW - ton niveau de confiance global sur cette estimation>",
              "rationale": "<1-2 phrases en français expliquant l'estimation (rareté, popularité, épuisement...) et ses limites>"
            }
            Règle impérative : ne JAMAIS inventer un chiffre plausible. Mets null pour pricePerVolume si tu n'es pas \
            raisonnablement certain plutôt que de deviner - une valeur absente est bien plus utile qu'une valeur fausse ici.""";

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:}")
    private String model;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Optional<AiPriceEstimate> estimateMarketPrice(String seriesTitle, String editionName, Condition condition) {
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        try {
            HttpResponse<String> response = GeminiRequests.send(httpClient, objectMapper, apiKey, model,
                    PROMPT_TEMPLATE.formatted(seriesTitle, editionName, condition.name()));
            if (response.statusCode() != 200) {
                log.warn("Gemini ({}) answered {} for edition '{}' / '{}': {}", GeminiRequests.effectiveModel(model),
                        response.statusCode(), seriesTitle, editionName, GeminiRequests.snippet(response.body()));
                return Optional.empty();
            }
            return parseEstimate(response.body());
        } catch (Exception e) {
            log.warn("Call to Gemini failed for '{}' / '{}': {}", seriesTitle, editionName, e.getMessage());
            return Optional.empty();
        }
    }

    /** Package-private for direct unit testing with a canned response body, bypassing HTTP. */
    Optional<AiPriceEstimate> parseEstimate(String generateContentResponseBody) throws Exception {
        String content = GeminiRequests.extractText(objectMapper, generateContentResponseBody);
        if (content == null || content.isBlank()) {
            return Optional.empty();
        }

        JsonNode json = objectMapper.readTree(content);
        JsonNode priceNode = json.path("pricePerVolume");
        ConfidenceLevel confidence = parseEnum(json.path("confidence").asText(null), ConfidenceLevel.LOW);
        String rationale = json.path("rationale").isMissingNode() || json.path("rationale").isNull()
                ? null : json.path("rationale").asText(null);

        if (priceNode.isNull() || priceNode.isMissingNode() || !priceNode.isNumber()) {
            // Never guess: no usable price announced by the model -> no number, and
            // above all not a 0 EUR. But this is an ANSWER, not an absence of answer: the prompt
            // explicitly asks for this "I do not know". Returning empty confused it with an
            // outage (quota, network, missing key), so it could not be remembered - and the same
            // question went to the provider again at each analysis.
            return Optional.of(new AiPriceEstimate(null, confidence, rationale));
        }

        return Optional.of(new AiPriceEstimate(BigDecimal.valueOf(priceNode.asDouble()), confidence, rationale));
    }

    private static ConfidenceLevel parseEnum(String value, ConfidenceLevel fallbackWhenBlankOrInvalid) {
        if (value == null || value.isBlank()) {
            return fallbackWhenBlankOrInvalid;
        }
        try {
            return ConfidenceLevel.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return fallbackWhenBlankOrInvalid;
        }
    }
}
