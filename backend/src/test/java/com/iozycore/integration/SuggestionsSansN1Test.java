package com.iozycore.integration;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.manga.deals.PurchaseAnalysisService;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>The cost of the purchase suggestions must not follow the size of the
 * collection.</b>
 *
 * <p>Finding C1 of the technical audit:
 * {@code GET /purchase-analysis/near-complete-suggestions} needed
 * <b>88 SQL queries for 5 series and 148 for 11</b> - about ten more per
 * series added. On the data set of the moment, the screen answered in 29 ms:
 * nothing could be seen, and this is exactly why a test is needed.
 * A regression here breaks no result, it just makes the screen slower
 * each time the user adds a series.
 *
 * <h2>What this test states, and what it refuses to state</h2>
 * It compares the <b>same call</b> on two catalogue sizes and requires that the
 * number of queries does <b>not grow</b> with the number of series. It deliberately
 * does not fix an absolute number: this figure depends on the content of the database
 * shared by the integration suite, and an exact threshold would have become outdated at the
 * first neighbour test added. What matters, and what was violated, is the
 * <b>slope</b>.
 *
 * <p>Witness measured on this data set (series smaller than those of
 * the audit, so smaller numbers): <b>38 then 70</b> queries before
 * the fix, <b>10 then 10</b> after. The test does fail on the code
 * from before.
 *
 * <h2>Why clear the persistence context between the two measures</h2>
 * The entities already loaded by the first measure would stay in the
 * first level cache and would hide a part of the loads of the second -
 * the measured slope would then be flatter than the real one.
 */
class SuggestionsSansN1Test extends PostgresIntegrationTest {

    @Autowired
    private PurchaseAnalysisService purchaseAnalysisService;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void le_nombre_de_requetes_ne_grandit_pas_avec_le_nombre_de_series() {
        Statistics statistiques = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistiques.setStatisticsEnabled(true);

        poserDesSeries(5);
        long avec5Series = requetesPourUnAppel(statistiques);

        poserDesSeries(6); // 11 in total, the two sizes measured by the audit
        long avec11Series = requetesPourUnAppel(statistiques);

        assertThat(avec11Series)
                .as("6 more series must not cost any more query (C1: +10 per series)")
                .isEqualTo(avec5Series);
    }

    private long requetesPourUnAppel(Statistics statistiques) {
        entityManager.flush();
        entityManager.clear();
        long avant = statistiques.getPrepareStatementCount();
        purchaseAnalysisService.findNearCompleteSuggestions();
        return statistiques.getPrepareStatementCount() - avant;
    }

    /** Series that are complete from their point of view: a reference edition, volumes, ownerships. */
    private void poserDesSeries(int combien) {
        for (int index = 0; index < combien; index++) {
            String titre = "Série C1 " + UUID.randomUUID();
            mangaEditionRepository.save(MangaEdition.create(titre, "Standard", EditionTier.STANDARD, "Éditeur",
                    10, new BigDecimal("7.90"), false, false, null));

            Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), titre);
            for (int tome = 1; tome <= 3; tome++) {
                serie.addVariant("Tome " + tome, Map.of("volumeNumber", tome, "edition", "Standard"));
            }
            entityRepository.save(serie);
            for (Variant variant : serie.variants()) {
                ownershipRepository.save(Ownership.acquire(serie.id(), variant.id(),
                        OwnershipCondition.NEW, LocalDate.now(), null));
            }
        }
    }
}
