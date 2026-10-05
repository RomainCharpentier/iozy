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
import com.iozycore.core.insights.StatsService;
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
 * <b>The three reads of {@code StatsService} must not cost more
 * as the collection grows.</b>
 *
 * <ul>
 *   <li><b>The value</b> feeds the hero of the Profile - the first number that one
 *       sees on arrival - and the Statistics screen;</li>
 *   <li><b>the summary</b> is all the rest of this screen;</li>
 *   <li><b>the yearly review</b> is seasonal, but is read over a whole year
 *       of acquisitions.</li>
 * </ul>
 *
 * <p>The three are of the same family as finding C1: a loop over the
 * series that reopens the same tables at each turn. The grouped versions
 * exist ({@code CollectionProgressService.computeAll()},
 * {@code EntityRepository.search}) - the point was to use them.
 *
 * <p>Each test compares the <b>same call</b> on two collection sizes and
 * requires that the number of queries does <b>not grow</b>. No absolute threshold:
 * the integration database is shared, and an exact number would become outdated at the
 * first neighbour test added. What matters, and what was violated, is the
 * slope.
 */
class StatsSansN1Test extends PostgresIntegrationTest {

    @Autowired
    private StatsService stats;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void la_valeur_de_la_collection_ne_coute_pas_plus_cher_avec_plus_de_series() {
        mesurerLaPente(stats::computeCollectionValue);
    }

    @Test
    void le_resume_des_statistiques_ne_coute_pas_plus_cher_avec_plus_de_series() {
        // This read loops over the collection TYPES, not over the
        // series: its cost follows the number of categories that were created, a
        // handful, and not the size of the collection. This test fixes it.
        mesurerLaPente(stats::computeSummary);
    }

    @Test
    void le_bilan_annuel_ne_coute_pas_plus_cher_avec_plus_de_series() {
        mesurerLaPente(() -> stats.computeYearlyRecap(java.time.LocalDate.now().getYear()));
    }

    /** The same call, two collection sizes, and the required equality. */
    private void mesurerLaPente(Runnable lecture) {
        Statistics statistiques = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistiques.setStatisticsEnabled(true);

        poserDesSeries(5);
        long avec5Series = requetesPourUnAppel(statistiques, lecture);

        poserDesSeries(6); // 11 more in total
        long avec11Series = requetesPourUnAppel(statistiques, lecture);

        assertThat(avec11Series)
                .as("6 more series must not cost any more query")
                .isEqualTo(avec5Series);
    }

    private long requetesPourUnAppel(Statistics statistiques, Runnable lecture) {
        // Clear the context: the entities already loaded would hide a part
        // of the reads of the second measure, and the slope would look flatter
        // than it is.
        entityManager.flush();
        entityManager.clear();
        long avant = statistiques.getPrepareStatementCount();
        lecture.run();
        return statistiques.getPrepareStatementCount() - avant;
    }

    /** Series that can be valued: an edition with a new price, and owned volumes. */
    private void poserDesSeries(int combien) {
        for (int index = 0; index < combien; index++) {
            String titre = "Série valeur " + UUID.randomUUID();
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
