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
/**
 * <h2>Le conteneur et le contexte viennent de {@link PostgresIntegrationTest}</h2>
 * Ce socle déclarait autrefois son propre {@code PostgreSQLContainer}, partagé
 * entre ses seules classes. C'était déjà la bonne idée, mais appliquée à un
 * tiers de la suite : quatorze autres classes en démarraient chacune un.
 * Le conteneur, le {@code @DynamicPropertySource} et {@code @SpringBootTest}
 * remontent donc d'un cran, et ce socle n'ajoute plus que ce qui lui est
 * propre - {@code MockMvc}.
 */
/**
 * <h2>Ces tests parlent au nom d'un compte connecté</h2>
 * Depuis que l'API est protégée (Lot 94), une requête anonyme reçoit 401 avant
 * d'atteindre le moindre contrôleur : les 86 endpoints couverts ici ne
 * testeraient plus que la page de refus. Chaque requête part donc authentifiée
 * et porte son jeton CSRF, posés <b>en un seul endroit</b> plutôt qu'ajoutés à
 * la main sur des centaines d'appels - une ligne oubliée quelque part se
 * lirait comme un défaut du contrôleur.
 * <p>
 * Ce que ce socle NE fait pas : vérifier la porte elle-même. C'est l'objet de
 * {@code AuthHttpContractTest}, qui envoie ses requêtes en anonyme.
 */
@AutoConfigureMockMvc
@Import(RequetesAuthentifiees.class)
public abstract class HttpContractTestBase extends PostgresIntegrationTest {

    /**
     * Le compte au nom duquel ces tests écrivent. Il porte l'identifiant du
     * propriétaire par défaut : les données créées par les migrations et par
     * les tests d'intégration existants lui appartiennent donc, exactement
     * comme le premier compte créé sur une instance reprend la collection
     * déjà en base.
     */
    protected static final AppUserDetailsService.Principal IDENTITE_DE_TEST =
            new AppUserDetailsService.Principal(DefaultOwner.ID, "test@iozycore.local", "{noop}sans-objet", "Test",
                    false);

    /**
     * Le même compte, administrateur. Réservé aux tests de {@code /api/admin/**} :
     * l'identité par défaut ci-dessus ne l'est PAS, sans quoi toute la suite
     * HTTP franchirait sans le dire une porte qui n'est ouverte qu'à un compte
     * sur beaucoup - et le refus opposé aux autres ne serait plus testé nulle
     * part.
     */
    protected static final AppUserDetailsService.Principal IDENTITE_ADMIN =
            new AppUserDetailsService.Principal(DefaultOwner.ID, "test@iozycore.local", "{noop}sans-objet", "Test",
                    true);

    @Autowired
    protected MockMvc mockMvc;

    /** Celui de l'application : les tests sérialisent comme le client réel. */
    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository comptes;

    /**
     * Le compte au nom duquel ces tests parlent <b>existe</b> en base.
     *
     * <p>Le principal ci-dessus est fabriqué, pas lu : aucune ligne ne se
     * trouvait derrière lui, et rien ne s'en apercevait - jusqu'à ce que la
     * chaîne de sécurité relise le compte à chaque requête pour fermer la
     * session d'un compte supprimé (voir {@code SecurityConfig.SessionDUnCompteSupprime}).
     * Un principal sans compte est précisément ce qu'elle refuse. La ligne
     * est posée par test, et annulée avec lui.
     */
    @BeforeEach
    void leCompteDeTestExiste() {
        if (comptes.findById(DefaultOwner.ID).isEmpty()) {
            comptes.save(AppUser.premier(IDENTITE_DE_TEST.email(), IDENTITE_DE_TEST.motDePasseHache(),
                    IDENTITE_DE_TEST.pseudo()));
        }
    }

    /** Un identifiant syntaxiquement valide qui ne désigne rien. */
    protected static final String ABSENT = "00000000-0000-0000-0000-0000000000ff";

    /** Un identifiant qui n'est pas un UUID - doit échouer à la conversion, jamais en 500. */
    protected static final String MALFORME = "pas-un-uuid";

    protected String json(Object valeur) throws Exception {
        return objectMapper.writeValueAsString(valeur);
    }
}
