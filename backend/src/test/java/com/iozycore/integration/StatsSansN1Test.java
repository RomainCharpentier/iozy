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
 * <b>Les trois lectures de {@code StatsService} ne doivent pas coûter plus cher
 * à mesure que la collection grandit.</b>
 *
 * <ul>
 *   <li><b>La valeur</b> alimente le hero du Profil - le premier chiffre qu'on
 *       voit en arrivant - et l'écran Statistiques ;</li>
 *   <li><b>le résumé</b> est tout le reste de cet écran ;</li>
 *   <li><b>le bilan annuel</b> est saisonnier, mais se lit sur toute une année
 *       d'acquisitions.</li>
 * </ul>
 *
 * <p>Les trois sont de la même famille que le constat C1 : une boucle sur les
 * séries qui rouvre les mêmes tables à chaque tour. Les versions groupées
 * existent ({@code CollectionProgressService.computeAll()},
 * {@code EntityRepository.search}) - il s'agissait de les employer.
 *
 * <p>Chaque test compare le <b>même appel</b> sur deux tailles de collection et
 * exige que le nombre de requêtes ne <b>croisse pas</b>. Pas de seuil absolu :
 * la base d'intégration est partagée, et un nombre exact se périmerait au
 * premier test voisin ajouté. Ce qui compte, et ce qui était violé, c'est la
 * pente.
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
        // Cette lecture-ci boucle sur les TYPES de collection, pas sur les
        // séries : son coût suit le nombre de catégories qu'on a créées, une
        // poignée, et pas la taille de la collection. Ce test le fixe.
        mesurerLaPente(stats::computeSummary);
    }

    @Test
    void le_bilan_annuel_ne_coute_pas_plus_cher_avec_plus_de_series() {
        mesurerLaPente(() -> stats.computeYearlyRecap(java.time.LocalDate.now().getYear()));
    }

    /** Le même appel, deux tailles de collection, et l'égalité exigée. */
    private void mesurerLaPente(Runnable lecture) {
        Statistics statistiques = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistiques.setStatisticsEnabled(true);

        poserDesSeries(5);
        long avec5Series = requetesPourUnAppel(statistiques, lecture);

        poserDesSeries(6); // 11 de plus au total
        long avec11Series = requetesPourUnAppel(statistiques, lecture);

        assertThat(avec11Series)
                .as("6 séries de plus ne doivent coûter aucune requête de plus")
                .isEqualTo(avec5Series);
    }

    private long requetesPourUnAppel(Statistics statistiques, Runnable lecture) {
        // Vider le contexte : les entités déjà chargées masqueraient une partie
        // des lectures de la seconde mesure, et la pente paraîtrait plus plate
        // qu'elle ne l'est.
        entityManager.flush();
        entityManager.clear();
        long avant = statistiques.getPrepareStatementCount();
        lecture.run();
        return statistiques.getPrepareStatementCount() - avant;
    }

    /** Des séries valorisables : une édition avec un prix neuf, et des tomes possédés. */
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
