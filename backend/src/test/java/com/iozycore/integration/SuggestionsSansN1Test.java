package com.iozycore.integration;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
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
 * <b>Le coût des suggestions d'achat ne doit pas suivre la taille de la
 * collection.</b>
 *
 * <p>Constat C1 de l'audit technique :
 * {@code GET /purchase-analysis/near-complete-suggestions} demandait
 * <b>88 requêtes SQL pour 5 séries et 148 pour 11</b> - une dizaine de plus par
 * série ajoutée. Sur le jeu de données du moment, l'écran répondait en 29 ms :
 * rien ne se voyait, et c'est précisément pourquoi un test est nécessaire.
 * Une régression ici ne casse aucun résultat, elle rend juste l'écran plus lent
 * chaque fois que l'utilisateur ajoute une série.
 *
 * <h2>Ce que ce test affirme, et ce qu'il refuse d'affirmer</h2>
 * Il compare le <b>même appel</b> sur deux tailles de catalogue et exige que le
 * nombre de requêtes ne <b>croisse pas</b> avec le nombre de séries. Il ne fige
 * volontairement pas un nombre absolu : ce chiffre dépend du contenu de la base
 * partagée par la suite d'intégration, et un seuil exact se serait périmé au
 * premier test voisin ajouté. Ce qui compte, et ce qui a été violé, c'est la
 * <b>pente</b>.
 *
 * <p>Témoin mesuré sur ce jeu-ci (des séries plus petites que celles de
 * l'audit, donc des nombres plus petits) : <b>38 puis 70</b> requêtes avant
 * correction, <b>10 puis 10</b> après. Le test échoue bien sur le code
 * d'avant.
 *
 * <h2>Pourquoi vider le contexte de persistance entre les deux mesures</h2>
 * Les entités déjà chargées par la première mesure resteraient dans le cache de
 * premier niveau et masqueraient une partie des chargements de la seconde -
 * la pente mesurée serait alors plus plate que la vraie.
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

        poserDesSeries(6); // 11 au total, les deux tailles mesurées par l'audit
        long avec11Series = requetesPourUnAppel(statistiques);

        assertThat(avec11Series)
                .as("6 séries de plus ne doivent coûter aucune requête de plus (C1 : +10 par série)")
                .isEqualTo(avec5Series);
    }

    private long requetesPourUnAppel(Statistics statistiques) {
        entityManager.flush();
        entityManager.clear();
        long avant = statistiques.getPrepareStatementCount();
        purchaseAnalysisService.findNearCompleteSuggestions();
        return statistiques.getPrepareStatementCount() - avant;
    }

    /** Des séries complètes de leur point de vue : une édition de référence, des tomes, des possessions. */
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
