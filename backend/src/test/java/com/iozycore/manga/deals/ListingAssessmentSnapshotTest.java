package com.iozycore.manga.deals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>Une analyse est un instantané, et un instantané se relit tel qu'il a été
 * pris.</b>
 * <p>
 * Les analyses vivent en JSONB (voir {@code PurchaseAnalysisJpaEntity}) : celles
 * enregistrées avant qu'un composant existe ne le portent tout simplement pas.
 * Le contrat est alors le même partout dans ce record : <b>dire qu'on l'ignore
 * plutôt que de l'inventer après coup</b> - une référence sans provenance rend
 * {@code NOT_RECORDED}, une référence sans réserves les rend nulles, jamais des
 * valeurs reconstituées qui donneraient à un ancien verdict une assurance qu'il
 * n'avait pas.
 * <p>
 * Ce test est ce qui autorise le record à n'avoir <b>qu'un seul</b>
 * constructeur : la compatibilité ascendante est une propriété de la
 * désérialisation, pas d'une surcharge à maintenir.
 */
class ListingAssessmentSnapshotTest {

    private static final ObjectMapper MAPPER = JsonMapper.builder().addModule(new JavaTimeModule()).build();

    /** Le contenu exact d'un payload enregistré avant le Lot 88 : dix composants, pas treize. */
    private static final String AVANT_LOT_88 = """
            {"collectionFit":null,"pricePosition":"FAIR_PRICE","referencePrice":50.00,
             "referenceConfidence":"HIGH","deviationPercent":-4,"trust":null,
             "headline":"GOOD_FOR_YOUR_COLLECTION","referenceSampleSize":3,
             "referenceSource":"OBSERVED_COMPARABLES","referenceGap":"NONE"}
            """;

    @Test
    void une_analyse_enregistree_avant_les_reserves_se_relit_sans_se_les_inventer() throws Exception {
        ListingAssessment assessment = MAPPER.readValue(AVANT_LOT_88, ListingAssessment.class);

        // Ce qu'elle portait est rendu intact.
        assertThat(assessment.referencePrice()).isEqualByComparingTo("50.00");
        assertThat(assessment.referenceSampleSize()).isEqualTo(3);
        assertThat(assessment.referenceSource()).isEqualTo(MarketReferenceSource.OBSERVED_COMPARABLES);
        assertThat(assessment.pricePosition()).isEqualTo(PricePosition.FAIR_PRICE);

        // Ce qu'elle ne portait pas reste absent - et se lit comme tel à l'écran.
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
