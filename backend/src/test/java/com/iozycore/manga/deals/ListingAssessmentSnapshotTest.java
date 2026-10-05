package com.iozycore.manga.deals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>An analysis is a snapshot, and a snapshot is read back as it was
 * taken.</b>
 * <p>
 * Analyses live in JSONB (see {@code PurchaseAnalysisJpaEntity}): those
 * saved before a component existed simply do not carry it.
 * The contract is then the same everywhere in this record: <b>say that it is unknown
 * rather than invent it afterwards</b> - a reference without provenance returns
 * {@code NOT_RECORDED}, a reference without caveats returns them as null, never
 * rebuilt values that would give an old verdict a confidence it
 * did not have.
 * <p>
 * This test is what allows the record to have <b>only one</b>
 * constructor: backward compatibility is a property of
 * deserialisation, not of an overload to maintain.
 */
class ListingAssessmentSnapshotTest {

    private static final ObjectMapper MAPPER = JsonMapper.builder().addModule(new JavaTimeModule()).build();

    /** The exact content of a payload saved before Batch 88: ten components, not thirteen. */
    private static final String AVANT_LOT_88 = """
            {"collectionFit":null,"pricePosition":"FAIR_PRICE","referencePrice":50.00,
             "referenceConfidence":"HIGH","deviationPercent":-4,"trust":null,
             "headline":"GOOD_FOR_YOUR_COLLECTION","referenceSampleSize":3,
             "referenceSource":"OBSERVED_COMPARABLES","referenceGap":"NONE"}
            """;

    @Test
    void une_analyse_enregistree_avant_les_reserves_se_relit_sans_se_les_inventer() throws Exception {
        ListingAssessment assessment = MAPPER.readValue(AVANT_LOT_88, ListingAssessment.class);

        // What it carried is returned intact.
        assertThat(assessment.referencePrice()).isEqualByComparingTo("50.00");
        assertThat(assessment.referenceSampleSize()).isEqualTo(3);
        assertThat(assessment.referenceSource()).isEqualTo(MarketReferenceSource.OBSERVED_COMPARABLES);
        assertThat(assessment.pricePosition()).isEqualTo(PricePosition.FAIR_PRICE);

        // What it did not carry stays absent - and reads as such on screen.
        assertThat(assessment.referenceSpreadPercent()).isNull();
        assertThat(assessment.referenceMostRecentObservation()).isNull();
        assertThat(assessment.referenceExaminedCount()).isZero();
    }

    @Test
    void une_analyse_encore_plus_ancienne_dit_ignorer_la_provenance_plutot_que_de_la_deviner() throws Exception {
        ListingAssessment assessment = MAPPER.readValue(
                "{\"pricePosition\":\"REFERENCE_UNAVAILABLE\",\"headline\":\"USEFUL_PRICE_UNKNOWN\"}",
                ListingAssessment.class);

        assertThat(assessment.referenceConfidence()).isEqualTo(MarketReferenceConfidence.UNAVAILABLE);
        assertThat(assessment.referenceSource()).isEqualTo(MarketReferenceSource.NOT_RECORDED);
        assertThat(assessment.referenceGap()).isEqualTo(ReferenceGap.NOT_RECORDED);
    }

    @Test
    void une_analyse_prise_depuis_le_lot_88_conserve_ses_trois_reserves() throws Exception {
        ListingAssessment ecrite = MAPPER.readValue(AVANT_LOT_88, ListingAssessment.class);
        LocalDate releve = LocalDate.of(2026, 8, 20);
        ListingAssessment complete = new ListingAssessment(ecrite.collectionFit(), ecrite.pricePosition(),
                ecrite.referencePrice(), ecrite.referenceConfidence(), ecrite.deviationPercent(), ecrite.trust(),
                ecrite.headline(), ecrite.referenceSampleSize(), ecrite.referenceSource(), ecrite.referenceGap(),
                20, releve, 5);

        ListingAssessment relue = MAPPER.readValue(MAPPER.writeValueAsString(complete), ListingAssessment.class);

        assertThat(relue.referenceSpreadPercent()).isEqualTo(20);
        assertThat(relue.referenceMostRecentObservation()).isEqualTo(releve);
        assertThat(relue.referenceExaminedCount()).isEqualTo(5);
    }
}
