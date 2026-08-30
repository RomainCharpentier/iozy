package com.iozycore.integration;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.insights.StatsService;
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
 * <b>« Valeur de la collection » ne doit pas coûter plus cher à mesure qu'elle
 * grandit.</b>
 *
 * <p>Ce calcul alimente le <b>hero du Profil</b> - le premier chiffre qu'on voit
 * en arrivant - et l'écran Statistiques. C'est exactement la figure du constat
 * C1, au même endroit du code : une boucle sur les séries qui demande la
 * progression <b>une fois par série</b>, plus une lecture du catalogue par
 * possession. Les deux versions groupées existent
 * ({@code CollectionProgressService.computeAll()} et
 * {@code EntityRepository.search}) et n'étaient pas employées.
 *
 * <p>Comme pour C1, ce test compare le <b>même appel</b> sur deux tailles de
 * collection et exige que le nombre de requêtes ne <b>croisse pas</b>. Pas de
 * seuil absolu : la base d'intégration est partagée, et un nombre exact se
 * périmerait au premier test voisin ajouté. Ce qui compte, et ce qui était
 * violé, c'est la pente.
 */
class ValeurSansN1Test extends PostgresIntegrationTest {

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
    void le_nombre_de_requetes_ne_grandit_pas_avec_le_nombre_de_series() {
        Statistics statistiques = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistiques.setStatisticsEnabled(true);

        poserDesSeries(5);
        long avec5Series = requetesPourUnAppel(statistiques);

        poserDesSeries(6); // 11 au total
        long avec11Series = requetesPourUnAppel(statistiques);

        assertThat(avec11Series)
                .as("6 séries de plus ne doivent coûter aucune requête de plus")
                .isEqualTo(avec5Series);
    }

    private long requetesPourUnAppel(Statistics statistiques) {
        // Vider le contexte : les entités déjà chargées masqueraient une partie
        // des lectures de la seconde mesure, et la pente paraîtrait plus plate
        // qu'elle ne l'est.
        entityManager.flush();
        entityManager.clear();
        long avant = statistiques.getPrepareStatementCount();
        stats.computeCollectionValue();
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
