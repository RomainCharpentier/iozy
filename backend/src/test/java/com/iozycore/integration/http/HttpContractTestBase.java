package com.iozycore.integration.http;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Socle des tests de <b>contrat HTTP</b> : la pile web réelle, pas une méthode
 * Java appelée directement.
 *
 * <h2>Ce que ce socle rend testable, et qui ne l'était pas</h2>
 * Le dépôt n'avait aucun test traversant la couche web. Les tests
 * d'intégration existants appellent les contrôleurs en Java
 * ({@code controller.delete(id)}), ce qui saute précisément l'endroit où les
 * défauts survivent : le routage, la désérialisation JSON, la conversion des
 * paramètres de chemin, et la traduction d'une exception métier en status HTTP.
 * Un {@code IllegalStateException} rendu en 500 au lieu de 409 est invisible
 * pour un appel direct, et parfaitement visible ici.
 *
 * <h2>Même infrastructure que les tests d'intégration existants</h2>
 * Testcontainers PostgreSQL, {@code @SpringBootTest}, {@code @Transactional} -
 * on ajoute seulement {@code @AutoConfigureMockMvc}. Pas de second framework
 * de test : le contexte est celui de l'application, donc l'{@code ObjectMapper}
 * et l'{@code ApiExceptionHandler} testés sont ceux qui tournent en production.
 *
 * <h2>Isolation</h2>
 * {@code @Transactional} sur le test enveloppe la requête MockMvc, qui s'exécute
 * dans le même thread : tout est annulé à la fin. La base reste déterministe
 * sans nettoyage manuel.
 * <p>
 * Une réserve à connaître : une requête qui viole une contrainte de base marque
 * la transaction {@code rollback-only}. Un test qui provoque un 409 de ce type
 * ne doit donc plus interroger la base ensuite - il vérifie le status et le
 * corps, ce qui est justement l'objet de ces tests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public abstract class HttpContractTestBase {

    /**
     * Conteneur unique pour toutes les classes qui héritent de ce socle,
     * démarré une fois et jamais arrêté explicitement.
     *
     * <h2>Pourquoi pas {@code @Container}</h2>
     * L'annotation lie le cycle de vie du conteneur à UNE classe de test : il
     * est arrêté dès qu'elle finit. Or Spring met son contexte en cache et le
     * réutilise pour la classe suivante - laquelle se retrouve donc avec une
     * DataSource pointant vers un conteneur mort ({@code This connection has
     * been closed}). Le problème est réel : la deuxième classe HTTP échouait
     * entièrement.
     * <p>
     * Un conteneur statique partagé vit aussi longtemps que la JVM de test,
     * exactement comme le contexte Spring qui s'y adosse. Docker le nettoie à
     * la fin du processus. Les classes qui déclarent leur propre conteneur
     * ailleurs dans la suite restent valides : chacune possède le sien.
     */
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    protected MockMvc mockMvc;

    /** Celui de l'application : les tests sérialisent comme le client réel. */
    @Autowired
    protected ObjectMapper objectMapper;

    /** Un identifiant syntaxiquement valide qui ne désigne rien. */
    protected static final String ABSENT = "00000000-0000-0000-0000-0000000000ff";

    /** Un identifiant qui n'est pas un UUID - doit échouer à la conversion, jamais en 500. */
    protected static final String MALFORME = "pas-un-uuid";

    protected String json(Object valeur) throws Exception {
        return objectMapper.writeValueAsString(valeur);
    }
}
