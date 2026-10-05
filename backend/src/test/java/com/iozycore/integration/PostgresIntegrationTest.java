package com.iozycore.integration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * One single PostgreSQL, one single Spring context, for <b>the whole</b>
 * integration suite.
 *
 * <h2>What this replaces, and what it cost</h2>
 * Fifteen classes each declared <b>their own</b>
 * {@code PostgreSQLContainer} with their own {@code @DynamicPropertySource}.
 * Each of them therefore paid, alone:
 * <ol>
 *   <li>the start of a Postgres container;</li>
 *   <li>the full run of the Flyway migrations V1 to V19;</li>
 *   <li><b>and above all</b> the complete rebuild of the Spring context.</li>
 * </ol>
 *
 * <p>The third point is the real culprit, and it is counter-intuitive:
 * Spring caches the test contexts, but the key of this cache includes
 * the <b>values</b> of the properties. Fifteen containers means fifteen different
 * JDBC URLs, so fifteen different keys, so <b>zero reuse</b> -
 * a cache that is never used even though it looks like it is there.
 *
 * <p>Measured: 29 integration classes for <b>341 s</b>, that is about 13 s
 * each, against 3.3 s for the 77 unit classes together. The single container
 * was already the rule for {@code HttpContractTestBase}, but only
 * for its own classes.
 *
 * <h2>A shared container, never {@code @Container}</h2>
 * The Testcontainers {@code @Container} annotation ties the life cycle of the
 * container to <b>one</b> class: it starts and stops it around that class.
 * But Spring keeps its context - and so its connection pool - alive
 * from one class to the next. The two life cycles do not match, and the
 * surviving context ends up pointing to a stopped container.
 *
 * <p>So the container is started <b>once</b>, in a static block, and
 * never stopped explicitly: Ryuk does it at the end of the JVM, and on
 * environments where Ryuk is disabled, the end of the process is enough.
 *
 * <h2>{@code @Transactional} isolates each method</h2>
 * Since all the classes now share the same database, isolation
 * is no longer a comfort but a necessity. The repositories (themselves
 * {@code @Transactional}, propagation {@code REQUIRED}) join the
 * transaction opened by the test, which Spring rolls back at the end of each
 * method.
 *
 * <p><b>Warning</b>: a class that counts rows must count a
 * <i>difference</i> (before/after), never an absolute total. The reference data
 * - entity types, preferences - are created by the migrations and shared.
 */
@SpringBootTest
@Transactional
// Outside a request, these tests speak in the name of the first account: see
// ComptePourLesTests for why the production fallback ("nobody")
// would make a hundred tests blind to what they have just written.
@Import(ComptePourLesTests.class)
public abstract class PostgresIntegrationTest {

    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("iozycore_test")
                    .withUsername("iozycore")
                    .withPassword("iozycore");

    static {
        // Started only once for the whole test JVM. The static block
        // rather than @Container: see above.
        POSTGRES.start();
    }

    /**
     * The same values for all the classes - this is <b>exactly</b> what
     * lets Spring reuse a single context instead of building
     * one per class.
     */
    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
