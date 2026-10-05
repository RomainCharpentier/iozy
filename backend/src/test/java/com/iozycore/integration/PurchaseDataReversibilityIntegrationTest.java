package com.iozycore.integration;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.listing.ShippingEstimateKind;
import com.iozycore.manga.deals.Condition;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.PurchaseAnalysis;
import com.iozycore.manga.deals.PurchaseAnalysisService;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.manga.deals.VolumeRange;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * The two data of the Purchase Analysis that the user creates explicitly -
 * a saved analysis, an observed price - must be removable.
 * <p>
 * Neither of them can be edited, and this is deliberate: an analysis is the
 * frozen result of a computation (correcting one number would produce a verdict that
 * was never computed) and an observation is a fact noted at a date (rewriting
 * it afterwards would rewrite the past on which the analyses rely).
 * We delete, and we start again.
 * <p>
 * The most important point is checked here: deleting an analysis does NOT touch
 * the observed prices or the editions filled in during this analysis - these
 * are reference data, which serve all the following analyses.
 */
class PurchaseDataReversibilityIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private PurchaseAnalysisService service;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    private MangaEdition uneEdition() {
        return mangaEditionRepository.save(MangaEdition.create(
                "Vinland Saga " + UUID.randomUUID(), "Standard", EditionTier.STANDARD, "Kurokawa",
                27, new BigDecimal("7.65"), false, false, null));
    }

    private PurchaseAnalysis uneAnalyse(MangaEdition edition) {
        return service.analyze(new AnalyzeListingCommand(
                ListingPlatform.VINTED, null, "Lot " + edition.seriesTitle(),
                null, new BigDecimal("60"), BigDecimal.ZERO, ShippingEstimateKind.UNKNOWN, BigDecimal.ZERO, Condition.VERY_GOOD, false,
                List.of(new AnalyzeListingItemCommand(edition.seriesTitle(), edition.editionName(), Set.of(1, 2, 3), null)),
                List.of()));
    }

    @Test
    void une_analyse_enregistree_peut_etre_supprimee_de_l_historique() {
        MangaEdition edition = uneEdition();
        PurchaseAnalysis analyse = uneAnalyse(edition);
        assertThat(service.history()).extracting(PurchaseAnalysis::id).contains(analyse.id());

        service.deleteAnalysis(analyse.id());

        assertThat(service.findAnalysisById(analyse.id())).isEmpty();
        assertThat(service.history()).extracting(PurchaseAnalysis::id).doesNotContain(analyse.id());
    }

    @Test
    void supprimer_une_analyse_conserve_les_prix_releves_et_l_edition() {
        MangaEdition edition = uneEdition();
        MarketPriceObservation releve = service.recordMarketObservation(
                edition.id(), new VolumeRange(1, 3), new BigDecimal("18"), ListingPlatform.VINTED,
                Condition.VERY_GOOD, LocalDate.now(), null);
        PurchaseAnalysis analyse = uneAnalyse(edition);

        service.deleteAnalysis(analyse.id());

        // These are reference data, not sub-objects of the analysis:
        // taking them away would make all the following analyses poorer.
        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .contains(releve.id());
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void supprimer_une_analyse_ne_touche_pas_aux_autres_analyses() {
        MangaEdition edition = uneEdition();
        PurchaseAnalysis premiere = uneAnalyse(edition);
        PurchaseAnalysis seconde = uneAnalyse(edition);

        service.deleteAnalysis(premiere.id());

        assertThat(service.findAnalysisById(seconde.id())).isPresent();
    }

    @Test
    void un_prix_releve_peut_etre_relu_puis_supprime() {
        MangaEdition edition = uneEdition();
        MarketPriceObservation releve = service.recordMarketObservation(
                edition.id(), null, new BigDecimal("450"), ListingPlatform.LEBONCOIN,
                Condition.GOOD, LocalDate.now(), "Virgule oubliée");

        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .contains(releve.id());

        service.deleteMarketObservation(releve.id());

        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .doesNotContain(releve.id());
        // Removing an observation does not touch the edition it documented.
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void supprimer_un_releve_ne_touche_pas_aux_autres_releves_de_l_edition() {
        MangaEdition edition = uneEdition();
        MarketPriceObservation faux = service.recordMarketObservation(
                edition.id(), null, new BigDecimal("450"), ListingPlatform.VINTED, null, LocalDate.now(), null);
        MarketPriceObservation juste = service.recordMarketObservation(
                edition.id(), null, new BigDecimal("45"), ListingPlatform.VINTED, null, LocalDate.now(), null);

        service.deleteMarketObservation(faux.id());

        assertThat(service.observationsOfEdition(edition.id())).extracting(MarketPriceObservation::id)
                .containsExactly(juste.id());
    }

    @Test
    void les_deux_suppressions_sont_idempotentes() {
        assertThatCode(() -> service.deleteAnalysis(UUID.randomUUID())).doesNotThrowAnyException();
        assertThatCode(() -> service.deleteMarketObservation(UUID.randomUUID())).doesNotThrowAnyException();
    }
}
