package com.iozycore.integration;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.deals.AiMarketPriceAdvisor;
import com.iozycore.manga.deals.AiPriceEstimate;
import com.iozycore.manga.deals.AiPriceEstimateCacheRepository;
import com.iozycore.manga.deals.Condition;
import com.iozycore.insights.ConfidenceLevel;
import com.iozycore.listing.ListingPlatform;
import com.iozycore.manga.deals.PriceBasis;
import com.iozycore.manga.deals.PurchaseAnalysis;
import com.iozycore.manga.deals.PurchaseAnalysisService;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingItemCommand;
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
 * <b>La même question ne repart pas deux fois chez le fournisseur d'IA.</b>
 *
 * <p>L'avis n'est demandé que lorsqu'aucun relevé réel n'existe pour l'édition
 * - donc sur les éditions qu'on analyse en boucle. Sans mémoire, chaque analyse
 * reposait la même question et consommait le quota du palier gratuit.
 *
 * <p>Le faux conseiller compte ses appels : c'est le seul moyen de dire « une
 * fois, pas deux ». Il suit le patron déjà en place pour les fournisseurs de
 * métadonnées ({@code FakeMetadataProviders}) - une classe de vingt lignes
 * plutôt qu'une bibliothèque de doublures.
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
                    // « Je ne sais pas » : une réponse, pas un échec.
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
        // Et la seconde analyse rend exactement la même estimation que la première.
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

        // C'est LA réponse la plus stable : la reposer serait la dépenser pour rien.
        assertThat(ConseillerQuiCompte.APPELS.get() - avant).isEqualTo(1);
        // Un avis sans chiffre ne fonde pas une base AI_ESTIMATED - on retombe sur le théorique.
        assertThat(premiere.itemBreakdown().get(0).marketPrice().basis()).isEqualTo(PriceBasis.THEORETICAL_ONLY);
        assertThat(cacheRepository.find(normalise(edition.seriesTitle()), "standard", Condition.VERY_GOOD))
                .hasValueSatisfying(memorise -> assertThat(memorise.pricePerVolume()).isNull());
    }

    private static String normalise(String valeur) {
        return valeur.trim().toLowerCase(java.util.Locale.ROOT);
    }
}
