package com.iozycore.purchaseanalysis.gemini;

import com.iozycore.purchaseanalysis.ConfidenceLevel;
import com.iozycore.purchaseanalysis.EditionSuggestion;
import com.iozycore.domain.catalog.EditionTier;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class GeminiEditionAdvisorTest {

    // Enveloppe generateContent - "text" porte le JSON métier tel que demandé au modèle
    // (generationConfig.responseMimeType=application/json).
    private static final String SAMPLE_RESPONSE = """
            {
              "candidates": [
                {
                  "content": {
                    "parts": [
                      {
                        "text": "{\\"totalVolumes\\": 12, \\"publisher\\": \\"Kana\\", \\"retailPriceNewPerVolume\\": 7.5, \\"outOfPrint\\": false, \\"betterEditionAnnounced\\": false, \\"betterEditionNote\\": null, \\"editionTier\\": \\"STANDARD\\", \\"confidence\\": \\"MEDIUM\\", \\"rationale\\": \\"Série terminée en 12 tomes chez Kana.\\"}"
                      }
                    ]
                  }
                }
              ]
            }
            """;

    @Test
    void no_api_key_configured_means_no_call_and_an_empty_result() {
        // apiKey (@Value) reste à sa valeur par défaut Java (null) hors conteneur Spring - même convention
        // que IgdbMetadataProvider/GoogleBooksHttpClient : jamais d'exception, juste absent.
        GeminiEditionAdvisor advisor = new GeminiEditionAdvisor();

        Optional<EditionSuggestion> suggestion = advisor.suggestReferenceData("Death Note", "Black Édition");

        assertThat(suggestion).isEmpty();
    }

    @Test
    void parses_a_generate_content_response_into_an_edition_suggestion() throws Exception {
        GeminiEditionAdvisor advisor = new GeminiEditionAdvisor();

        Optional<EditionSuggestion> suggestion = advisor.parseSuggestion(SAMPLE_RESPONSE);

        assertThat(suggestion).isPresent();
        EditionSuggestion value = suggestion.get();
        assertThat(value.totalVolumes()).isEqualTo(12);
        assertThat(value.publisher()).isEqualTo("Kana");
        assertThat(value.retailPriceNewPerVolume()).isEqualByComparingTo(new BigDecimal("7.5"));
        assertThat(value.outOfPrint()).isFalse();
        assertThat(value.betterEditionAnnounced()).isFalse();
        assertThat(value.betterEditionNote()).isNull();
        assertThat(value.tier()).isEqualTo(EditionTier.STANDARD);
        assertThat(value.confidence()).isEqualTo(ConfidenceLevel.MEDIUM);
        assertThat(value.rationale()).contains("12 tomes");
    }

    @Test
    void an_unparseable_or_empty_response_yields_an_empty_result_never_an_exception() throws Exception {
        GeminiEditionAdvisor advisor = new GeminiEditionAdvisor();

        assertThat(advisor.parseSuggestion("""
                { "candidates": [] }
                """)).isEmpty();
    }

    @Test
    void an_unknown_confidence_or_tier_value_falls_back_safely_instead_of_failing() throws Exception {
        GeminiEditionAdvisor advisor = new GeminiEditionAdvisor();

        Optional<EditionSuggestion> suggestion = advisor.parseSuggestion("""
                {
                  "candidates": [
                    { "content": { "parts": [ { "text": "{\\"editionTier\\": \\"NOT_A_REAL_TIER\\", \\"confidence\\": \\"VERY_SURE\\"}" } ] } }
                  ]
                }
                """);

        assertThat(suggestion).isPresent();
        // Confiance jamais devinée à la hausse : une valeur non reconnue retombe sur LOW, jamais HIGH/MEDIUM.
        assertThat(suggestion.get().confidence()).isEqualTo(ConfidenceLevel.LOW);
        assertThat(suggestion.get().tier()).isNull();
    }
}
