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
 * <b>La porte, sur un vrai serveur — parce que MockMvc ment sur un point
 * précis.</b>
 *
 * <h2>Le défaut qu'aucun autre test ne pouvait voir</h2>
 * Un 404 ne s'écrit pas directement : le conteneur le <b>redirige en
 * interne</b> vers la page d'erreur, et depuis Spring Security 6 cette
 * redirection retraverse la chaîne de sécurité. Une règle qui ne l'autorise
 * pas transforme donc le 404 destiné à un visiteur anonyme en <b>401</b>.
 * <p>
 * MockMvc ne rejoue pas cette redirection : il rendait 404, et les tests
 * passaient. C'est en ouvrant un lien de partage dans un vrai navigateur que
 * le 401 est apparu - sur la seule surface de l'application dont le
 * destinataire n'a, par définition, pas de compte.
 *
 * <h2>Pourquoi si peu de cas ici</h2>
 * Ce test démarre un vrai serveur, donc un second contexte Spring : il coûte.
 * Il ne reprend donc pas ce que {@link AuthHttpContractTest} couvre déjà - il
 * vérifie les trois seules réponses dont la redirection d'erreur change le
 * sens : ce qui doit rester ouvert, ce qui doit rester fermé, et le 404 d'un
 * lien de partage inconnu.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PorteSurUnVraiServeurTest {

    // Le conteneur de PostgresIntegrationTest n'est pas réutilisable ici : cette
    // classe ne peut pas en hériter (elle a besoin de son propre webEnvironment,
    // et surtout PAS de @Transactional - le serveur répond dans un autre thread).
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

        // 401 ici voudrait dire « crée-toi un compte pour voir ce lien » - ce
        // qui vide de son sens la seule fonctionnalité prévue pour des gens
        // qui n'en auront jamais.
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
