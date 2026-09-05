package com.iozycore.manga.deals.gemini;

import com.iozycore.manga.deals.AiPriceEstimate;
import com.iozycore.manga.deals.Condition;
import com.iozycore.core.insights.ConfidenceLevel;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class GeminiMarketPriceAdvisorTest {

    private static final String SAMPLE_RESPONSE = """
            {
              "candidates": [
                {
                  "content": {
                    "parts": [
                      {
                        "text": "{\\"pricePerVolume\\": 16.00, \\"confidence\\": \\"MEDIUM\\", \\"rationale\\": \\"Tome recherché, souvent épuisé.\\"}"
                      }
                    ]
                  }
                }
              ]
            }
            """;

    @Test
    void no_api_key_configured_means_no_call_and_an_empty_result() {
        GeminiMarketPriceAdvisor advisor = new GeminiMarketPriceAdvisor();

        Optional<AiPriceEstimate> estimate = advisor.estimateMarketPrice("Vinland Saga", "Deluxe", Condition.GOOD);

        assertThat(estimate).isEmpty();
    }

    @Test
    void parses_a_generate_content_response_into_a_price_estimate() throws Exception {
        GeminiMarketPriceAdvisor advisor = new GeminiMarketPriceAdvisor();

        Optional<AiPriceEstimate> estimate = advisor.parseEstimate(SAMPLE_RESPONSE);

        assertThat(estimate).isPresent();
        assertThat(estimate.get().pricePerVolume()).isEqualByComparingTo(new BigDecimal("16.00"));
        assertThat(estimate.get().confidence()).isEqualTo(ConfidenceLevel.MEDIUM);
        assertThat(estimate.get().rationale()).contains("recherché");
    }

    @Test
    void a_null_price_never_invents_a_figure() throws Exception {
        GeminiMarketPriceAdvisor advisor = new GeminiMarketPriceAdvisor();

        Optional<AiPriceEstimate> estimate = advisor.parseEstimate("""
                {
                  "candidates": [
                    { "content": { "parts": [ { "text": "{\\"pricePerVolume\\": null, \\"confidence\\": \\"LOW\\"}" } ] } }
                  ]
                }
                """);

        // L'intention du test ne change pas - aucun chiffre n'est invente - mais un « je ne sais
        // pas » est une REPONSE, que l'invite demande explicitement au modele de donner. La rendre
        // vide la confondait avec une panne (quota, reseau, cle absente), donc l'empechait d'etre
        // memorisee : la meme question repartait chez le fournisseur a chaque analyse.
        assertThat(estimate).hasValueSatisfying(reponse -> {
            assertThat(reponse.pricePerVolume()).isNull();
            assertThat(reponse.confidence()).isEqualTo(ConfidenceLevel.LOW);
        });
    }

    @Test
    void an_unparseable_or_empty_response_yields_an_empty_result_never_an_exception() throws Exception {
        GeminiMarketPriceAdvisor advisor = new GeminiMarketPriceAdvisor();

        assertThat(advisor.parseEstimate("""
                { "candidates": [] }
                """)).isEmpty();
    }
}
