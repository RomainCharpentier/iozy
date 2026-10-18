package com.iozycore.integration.http;

import com.iozycore.integration.PostgresIntegrationTest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Base of the <b>HTTP contract</b> tests: the real web stack, not a Java
 * method called directly.
 *
 * <h2>What this base makes testable, and was not</h2>
 * The repository had no test going through the web layer. The existing
 * integration tests call the controllers in Java
 * ({@code controller.delete(id)}), which skips precisely the place where
 * defects survive: the routing, the JSON deserialisation, the conversion of
 * path parameters, and the translation of a business exception into an HTTP status.
 * An {@code IllegalStateException} returned as a 500 instead of a 409 is invisible
 * for a direct call, and perfectly visible here.
 *
 * <h2>Same infrastructure as the existing integration tests</h2>
 * Testcontainers PostgreSQL, {@code @SpringBootTest}, {@code @Transactional} -
 * we only add {@code @AutoConfigureMockMvc}. No second test framework:
 * the context is the one of the application, so the {@code ObjectMapper}
 * and the {@code ApiExceptionHandler} tested are the ones that run in production.
 *
 * <h2>Isolation</h2>
 * {@code @Transactional} on the test wraps the MockMvc request, which runs
 * in the same thread: everything is rolled back at the end. The database stays deterministic
 * without manual cleaning.
 * <p>
 * One reservation to know: a request that violates a database constraint marks
 * the transaction {@code rollback-only}. A test that causes a 409 of this kind
 * must therefore no longer query the database afterwards - it checks the status and the
 * body, which is precisely the purpose of these tests.
 */
/**
 * <h2>The container and the context come from {@link PostgresIntegrationTest}</h2>
 * This base used to declare its own {@code PostgreSQLContainer}, shared
 * between its own classes only. It was already the right idea, but applied to a
 * third of the suite: fourteen other classes each started one.
 * The container, the {@code @DynamicPropertySource} and {@code @SpringBootTest}
 * therefore go up one level, and this base only adds what is
 * specific to it - {@code MockMvc}.
 */
/**
 * <h2>These tests speak in the name of a connected account</h2>
 * Since the API is protected (Batch 94), an anonymous request receives 401 before
 * reaching any controller: the 86 endpoints covered here would
 * only test the refusal page. Each request therefore goes out authenticated
 * and carries its CSRF token, set <b>in one single place</b> rather than added by
 * hand to hundreds of calls - a line forgotten somewhere would
 * read as a defect of the controller.
 * <p>
 * What this base does NOT do: check the door itself. That is the purpose of
 * {@code AuthHttpContractTest}, which sends its requests anonymously.
 */
@AutoConfigureMockMvc
@Import(RequetesAuthentifiees.class)
public abstract class HttpContractTestBase extends PostgresIntegrationTest {

    /**
     * The account in the name of which these tests write. It carries the identifier of the
     * default owner: the data created by the migrations and by
     * the existing integration tests therefore belong to it, exactly
     * like the first account created on an instance takes over the collection
     * already in the database.
     */
    protected static final AppUserDetailsService.Principal IDENTITE_DE_TEST =
            new AppUserDetailsService.Principal(DefaultOwner.ID, "test@iozycore.local", "{noop}sans-objet", "Test",
                    false);

    /**
     * The same account, administrator. Reserved for the tests of {@code /api/admin/**}:
     * the default identity above is NOT one, otherwise the whole HTTP suite
     * would silently go through a door that is only open to one account
     * out of many - and the refusal given to the others would no longer be tested
     * anywhere.
     */
    protected static final AppUserDetailsService.Principal IDENTITE_ADMIN =
            new AppUserDetailsService.Principal(DefaultOwner.ID, "test@iozycore.local", "{noop}sans-objet", "Test",
                    true);

    @Autowired
    protected MockMvc mockMvc;

    /** The one of the application: the tests serialise like the real client. */
    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository comptes;

    /**
     * The account in the name of which these tests speak <b>exists</b> in the database.
     *
     * <p>The principal above is made up, not read: no row was
     * behind it, and nothing noticed - until the
     * security chain read the account again at each request to close the
     * session of a deleted account (see {@code SecurityConfig.SessionDUnCompteSupprime}).
     * A principal without an account is precisely what it refuses. The row
     * is set per test, and rolled back with it.
     */
    @BeforeEach
    void leCompteDeTestExiste() {
        if (comptes.findById(DefaultOwner.ID).isEmpty()) {
            comptes.save(AppUser.premier(IDENTITE_DE_TEST.email(), IDENTITE_DE_TEST.motDePasseHache(),
                    IDENTITE_DE_TEST.pseudo()));
        }
    }

    /** A syntactically valid identifier that points to nothing. */
    protected static final String ABSENT = "00000000-0000-0000-0000-0000000000ff";

    /** An identifier that is not a UUID - must fail at the conversion, never with a 500. */
    protected static final String MALFORME = "pas-un-uuid";

    protected String json(Object valeur) throws Exception {
        return objectMapper.writeValueAsString(valeur);
    }
}
