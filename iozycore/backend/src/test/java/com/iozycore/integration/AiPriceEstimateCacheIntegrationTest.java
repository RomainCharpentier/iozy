package com.iozycore.integration;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.domain.deals.AiMarketPriceAdvisor;
import com.iozycore.manga.domain.deals.AiPriceEstimate;
import com.iozycore.manga.domain.deals.AiPriceEstimateCacheRepository;
import com.iozycore.manga.domain.deals.Condition;
import com.iozycore.manga.domain.deals.ConfidenceLevel;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.domain.deals.PriceBasis;
import com.iozycore.manga.domain.deals.PurchaseAnalysis;
import com.iozycore.manga.application.deals.PurchaseAnalysisService;
import com.iozycore.manga.application.deals.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.manga.application.deals.PurchaseAnalysisService.AnalyzeListingItemCommand;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>The same question is not sent twice to the AI provider.</b>
 *
 * <p>The advice is only requested when no real observation exists for the edition
 * - so for the editions that are analysed again and again. Without a memory, each analysis
 * asked the same question again and used the quota of the free tier.
 *
 * <p>The fake advisor counts its calls: this is the only way to say "once,
 * not twice". It follows the pattern already used for the metadata providers
 * ({@code FakeMetadataProviders}) - a class of twenty lines
 * instead of a library of test doubles.
 */
@Import(AiPriceEstimateCacheIntegrationTest.ConseillerQuiCompte.class)
class AiPriceEstimateCacheIntegrationTest extends PostgresIntegrationTest {

    @TestConfiguration
    static class ConseillerQuiCompte {

        static final AtomicInteger APPELS = new AtomicInteger();
        static final AtomicInteger REPONSES_SANS_PRIX = new AtomicInteger();

        @Bean
        @Primary
        AiMarketPriceAdvisor conseillerQuiCompte() {
            return (seriesTitle, editionName, condition) -> {
                APPELS.incrementAndGet();
                if (REPONSES_SANS_PRIX.get() > 0) {
                    REPONSES_SANS_PRIX.decrementAndGet();
                    // "I do not know": an answer, not a failure.
                    return Optional.of(new AiPriceEstimate(null, ConfidenceLevel.LOW, "aucune idée"));
                }
                return Optional.of(new AiPriceEstimate(new BigDecimal("7.50"), ConfidenceLevel.MEDIUM, "au pif éclairé"));
            };
        }
    }

    @Autowired
    private PurchaseAnalysisService service;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private AiPriceEstimateCacheRepository cacheRepository;

    private MangaEdition uneEdition() {
        return mangaEditionRepository.save(MangaEdition.create(
                "Cache IA " + UUID.randomUUID(), "Standard", EditionTier.STANDARD, "Kaze",
                10, new BigDecimal("6.99"), false, false, null));
    }

    private PurchaseAnalysis analyser(MangaEdition edition) {
        return service.analyze(new AnalyzeListingCommand(
                ListingPlatform.VINTED, null, "Lot " + edition.seriesTitle(), null, new BigDecimal("30"),
                null, null, null, Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(edition.seriesTitle(), edition.editionName(), Set.of(1, 2, 3), null)),
                List.of(), null));
    }

    @Test
    void la_meme_edition_analysee_deux_fois_ne_demande_l_avis_de_l_ia_qu_une_seule_fois() {
        MangaEdition edition = uneEdition();
        int avant = ConseillerQuiCompte.APPELS.get();

        PurchaseAnalysis premiere = analyser(edition);
        PurchaseAnalysis seconde = analyser(edition);

        assertThat(ConseillerQuiCompte.APPELS.get() - avant).isEqualTo(1);
        // And the second analysis returns exactly the same estimate as the first one.
        assertThat(premiere.itemBreakdown().get(0).marketPrice().basis()).isEqualTo(PriceBasis.AI_ESTIMATED);
        assertThat(seconde.itemBreakdown().get(0).marketPrice().aiEstimatedPrice())
                .isEqualByComparingTo(premiere.itemBreakdown().get(0).marketPrice().aiEstimatedPrice());
    }

    @Test
    void un_je_ne_sais_pas_se_memorise_aussi_et_ne_devient_pas_un_prix() {
        MangaEdition edition = uneEdition();
        ConseillerQuiCompte.REPONSES_SANS_PRIX.set(1);
        int avant = ConseillerQuiCompte.APPELS.get();

        PurchaseAnalysis premiere = analyser(edition);
        analyser(edition);

        // This is THE most stable answer: asking it again would be spending it for nothing.
        assertThat(ConseillerQuiCompte.APPELS.get() - avant).isEqualTo(1);
        // An advice without a number does not create an AI_ESTIMATED base - we fall back to the theoretical one.
        assertThat(premiere.itemBreakdown().get(0).marketPrice().basis()).isEqualTo(PriceBasis.THEORETICAL_ONLY);
        assertThat(cacheRepository.find(normalise(edition.seriesTitle()), "standard", Condition.VERY_GOOD))
                .hasValueSatisfying(memorise -> assertThat(memorise.pricePerVolume()).isNull());
    }

    private static String normalise(String valeur) {
        return valeur.trim().toLowerCase(java.util.Locale.ROOT);
    }
}
