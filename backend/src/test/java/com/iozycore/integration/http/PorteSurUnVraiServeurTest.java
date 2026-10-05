package com.iozycore.integration.http;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>The door, on a real server - because MockMvc lies on one precise
 * point.</b>
 *
 * <h2>The defect that no other test could see</h2>
 * A 404 is not written directly: the container <b>redirects it
 * internally</b> to the error page, and since Spring Security 6 this
 * redirection goes through the security chain again. A rule that does not allow it
 * therefore turns the 404 meant for an anonymous visitor into a <b>401</b>.
 * <p>
 * MockMvc does not replay this redirection: it returned 404, and the tests
 * passed. It was by opening a share link in a real browser that
 * the 401 appeared - on the only surface of the application whose
 * recipient has, by definition, no account.
 *
 * <h2>Why so few cases here</h2>
 * This test starts a real server, so a second Spring context: it is costly.
 * It therefore does not repeat what {@link AuthHttpContractTest} already covers - it
 * checks the only three responses whose meaning the error redirection changes:
 * what must stay open, what must stay closed, and the 404 of an unknown
 * share link.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PorteSurUnVraiServeurTest {

    // The container of PostgresIntegrationTest cannot be reused here: this
    // class cannot inherit from it (it needs its own webEnvironment,
    // and above all NO @Transactional - the server answers in another thread).
    @SuppressWarnings("resource")
    private static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine").withReuse(true);

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void proprietes(DynamicPropertyRegistry registre) {
        registre.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registre.add("spring.datasource.username", POSTGRES::getUsername);
        registre.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private TestRestTemplate http;

    @Test
    void un_lien_de_partage_inconnu_rend_404_a_un_visiteur_anonyme_et_non_401() {
        ResponseEntity<String> reponse = http.getForEntity("/api/public/share/jeton-qui-n-existe-pas", String.class);

        // A 401 here would mean "create an account to see this link" - which
        // empties of its meaning the only feature planned for people
        // who will never have one.
        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void une_collection_reste_fermee_a_qui_n_a_pas_de_compte() {
        assertThat(http.getForEntity("/api/entities/search", String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void l_etat_de_l_instance_reste_lisible_sans_compte() {
        assertThat(http.getForEntity("/api/auth/etat", String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }
}
