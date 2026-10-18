package com.iozycore.manga.domain.deals;

import com.iozycore.core.listing.ShippingEstimateKind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.listing.ListingPlatform;

/**
 * Declaring that the edition is unknown must be a <b>usable</b> choice,
 * not a confession that breaks the analysis.
 *
 * <p>The context: the edition is required on a {@link ListingItem} because
 * it links the batch to a work page. But forcing it to be <i>guessed</i> was
 * a flaw: typing "Standard" at random can match another edition by accident
 * and distort the market reference. {@link
 * ListingItem#EDITION_INCONNUE} makes ignorance declarable, and these tests
 * check that the engine draws honest consequences from it.
 */
class UnknownEditionTest {

    private final PurchaseAnalysisEngine engine = new PurchaseAnalysisEngine();
    private final CollectorPreferences defaults = CollectorPreferences.defaults();

    private static ListingItem sansEdition(String serie, Set<Integer> tomes) {
        return new ListingItem(new MangaSeries(serie, null), ListingItem.EDITION_INCONNUE, tomes, null);
    }

    private static Listing annonce(ListingItem... items) {
        return new Listing(UUID.randomUUID(), ListingPlatform.VINTED, null, "Lot de test", null,
                new BigDecimal("45"), BigDecimal.ZERO, ShippingEstimateKind.FREE, BigDecimal.ZERO,
                Condition.VERY_GOOD, false, List.of(items), List.of(), Instant.now());
    }

    private PurchaseAnalysis analyser(ListingItem item) {
        // matchedEdition == null: no work page carries this name, and that is intended.
        return engine.analyze(annonce(item),
                List.of(new PurchaseAnalysisEngine.ItemContext(item, null, List.of(), List.of(), Set.of())),
                defaults);
    }

    @Test
    void an_unknown_edition_is_accepted_and_the_analysis_still_runs() {
        PurchaseAnalysis analysis = analyser(sansEdition("Platinum End", Set.of(1, 2, 3)));

        assertThat(analysis.verdict()).isNotNull();
        assertThat(analysis.itemBreakdown()).hasSize(1);
    }

    @Test
    void the_item_says_plainly_that_the_edition_was_not_named() {
        ListingItem item = sansEdition("Platinum End", Set.of(1));

        assertThat(item.editionIsUnknown()).isTrue();
        assertThat(new ListingItem(new MangaSeries("Platinum End", null), "Standard", Set.of(1), null)
                .editionIsUnknown()).isFalse();
    }

    @Test
    void an_unknown_edition_is_recognised_whatever_its_casing() {
        // The label goes through a text field: a different case stays
        // the same declaration.
        assertThat(new ListingItem(new MangaSeries("X", null), "édition inconnue", Set.of(1), null)
                .editionIsUnknown()).isTrue();
    }

    @Test
    void the_warning_does_not_advise_completing_a_sheet_that_cannot_exist() {
        // "Complète sa fiche" is advice that cannot be applied when nobody
        // knows which edition it is. The message must say something else.
        PurchaseAnalysis analysis = analyser(sansEdition("Platinum End", Set.of(1, 2, 3)));

        List<String> messages = analysis.itemBreakdown().get(0).editionWarnings().stream()
                .map(Warning::message).toList();

        assertThat(messages).anySatisfy(message ->
                assertThat(message).contains("n'est pas précisée"));
        assertThat(messages).noneSatisfy(message ->
                assertThat(message).contains("complète sa fiche"));
    }

    @Test
    void the_sentinel_label_never_leaks_into_a_warning_as_if_it_were_a_real_edition() {
        // "L'édition "Édition inconnue" n'est pas encore renseignée" would be
        // absurd to read.
        PurchaseAnalysis analysis = analyser(sansEdition("Platinum End", Set.of(1, 2, 3)));

        assertThat(analysis.itemBreakdown().get(0).editionWarnings())
                .noneSatisfy(warning ->
                        assertThat(warning.message()).contains("\"" + ListingItem.EDITION_INCONNUE + "\""));
    }

    @Test
    void completeness_is_reported_unknown_rather_than_guessed() {
        PurchaseAnalysis analysis = analyser(sansEdition("Platinum End", Set.of(1, 2, 3)));

        // Without an edition, we do not know how many volumes the series has: we say so,
        // we do not invent it.
        assertThat(analysis.itemBreakdown().get(0).completeness().isKnown()).isFalse();
    }

    @Test
    void a_named_but_uncatalogued_edition_still_advises_completing_its_sheet() {
        // The other branch stays intact: there, there really is a work page to create.
        ListingItem item = new ListingItem(new MangaSeries("Platinum End", null), "Perfect", Set.of(1), null);

        PurchaseAnalysis analysis = engine.analyze(annonce(item),
                List.of(new PurchaseAnalysisEngine.ItemContext(item, null, List.of(), List.of(), Set.of())),
                defaults);

        assertThat(analysis.itemBreakdown().get(0).editionWarnings())
                .anySatisfy(warning -> assertThat(warning.message()).contains("complète sa fiche"));
    }
}
