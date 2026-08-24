package com.iozycore.integration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Un seul PostgreSQL, un seul contexte Spring, pour <b>toute</b> la suite
 * d'intégration.
 *
 * <h2>Ce que ça remplace, et ce que ça coûtait</h2>
 * Quinze classes déclaraient chacune <b>leur propre</b>
 * {@code PostgreSQLContainer} avec son propre {@code @DynamicPropertySource}.
 * Chacune payait donc, à elle seule :
 * <ol>
 *   <li>le démarrage d'un conteneur Postgres ;</li>
 *   <li>l'exécution complète des migrations Flyway V1 à V19 ;</li>
 *   <li><b>et surtout</b> la reconstruction intégrale du contexte Spring.</li>
 * </ol>
 *
 * <p>Le troisième point est le vrai coupable, et il est contre-intuitif :
 * Spring met les contextes de test en cache, mais la clé de ce cache inclut
 * les <b>valeurs</b> des propriétés. Quinze conteneurs, c'est quinze URLs JDBC
 * différentes, donc quinze clés différentes, donc <b>zéro réutilisation</b> —
 * un cache qui ne sert jamais alors qu'il a l'air d'être là.
 *
 * <p>Mesuré : 29 classes d'intégration pour <b>341 s</b>, soit environ 13 s
 * chacune, contre 3,3 s pour les 77 classes unitaires réunies. Le conteneur
 * unique était déjà la règle côté {@code HttpContractTestBase}, mais seulement
 * pour ses propres classes.
 *
 * <h2>Un conteneur partagé, jamais {@code @Container}</h2>
 * L'annotation {@code @Container} de Testcontainers lie le cycle de vie du
 * conteneur à <b>une</b> classe : elle le démarre et l'arrête autour d'elle.
 * Or Spring, lui, garde son contexte — et donc son pool de connexions — vivant
 * d'une classe à l'autre. Les deux cycles de vie ne s'accordent pas, et le
 * contexte survivant se retrouve à pointer vers un conteneur éteint.
 *
 * <p>Le conteneur est donc démarré <b>une fois</b>, dans un bloc statique, et
 * jamais arrêté explicitement : Ryuk s'en charge à la fin du JVM, et sur les
 * environnements où Ryuk est désactivé, la fin du processus suffit.
 *
 * <h2>{@code @Transactional} isole chaque méthode</h2>
 * Puisque toutes les classes partagent désormais la même base, l'isolation
 * n'est plus un confort mais une nécessité. Les repositories (eux-mêmes
 * {@code @Transactional}, propagation {@code REQUIRED}) rejoignent la
 * transaction ouverte par le test, que Spring annule à la fin de chaque
 * méthode.
 *
 * <p><b>Attention</b> : une classe qui compte des lignes doit compter un
 * <i>écart</i> (avant/après), jamais un total absolu. Les données de référence
 * — types d'entité, préférences — sont créées par les migrations et partagées.
 */
@SpringBootTest
@Transactional
public abstract class PostgresIntegrationTest {

    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("iozycore_test")
                    .withUsername("iozycore")
                    .withPassword("iozycore");

    static {
        // Démarré une seule fois pour toute la JVM de test. Le bloc statique
        // plutôt que @Container : voir plus haut.
        POSTGRES.start();
    }

    /**
     * Les mêmes valeurs pour toutes les classes — c'est <b>exactement</b> ce qui
     * permet à Spring de réutiliser un unique contexte au lieu d'en construire
     * un par classe.
     */
    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
