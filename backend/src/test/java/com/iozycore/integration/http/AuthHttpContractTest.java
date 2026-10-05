package com.iozycore.integration.http;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.application.admin.GestionDesComptes;
import com.iozycore.integration.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * <b>The door itself.</b>
 *
 * <p>All the other contract tests act in the name of a connected account (see
 * {@link RequetesAuthentifiees}): they check what the application does
 * <i>once you are in</i>. This one does the opposite - it knocks as
 * <b>anonymous</b>, and checks what opens and what closes.
 *
 * <h2>What is at stake</h2>
 * A route forgotten in the list of exceptions, and a whole collection is
 * readable by whoever finds the address. One route too many protected, and a share
 * link stops working for its recipient - who has no
 * account and never will. Both errors are silent: nothing in
 * the application changes its look.
 */
@AutoConfigureMockMvc
class AuthHttpContractTest extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private GestionDesComptes gestionDesComptes;

    private String json(Object valeur) throws Exception {
        return objectMapper.writeValueAsString(valeur);
    }

    // ------------------------------------------------------- What is closed

    @Test
    void une_collection_ne_se_lit_pas_sans_compte() throws Exception {
        mockMvc.perform(get("/api/entities/search")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/ownerships")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/insights/stats")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/wishlist")).andExpect(status().isUnauthorized());
    }

    @Test
    void une_ecriture_anonyme_n_atteint_jamais_le_controleur() throws Exception {
        // With the CSRF token, so that the refusal really comes from the lack of an
        // account and not from a missing token - two different refusals.
        mockMvc.perform(post("/api/entities").with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void la_version_du_serveur_ne_se_lit_pas_avant_de_s_etre_connecte() throws Exception {
        // Knowing the exact version of a server is as useful to exploit it
        // as to attack it, and nobody needs to read it BEFORE getting in:
        // it is shown in the Settings, not on the door.
        mockMvc.perform(get("/api/version")).andExpect(status().isUnauthorized());
    }

    @Test
    void une_fois_connecte_la_version_dit_quelle_livraison_tourne() throws Exception {
        MockHttpSession session = connecter();

        // "dev" outside a container: it is the default value, and the fact
        // that it comes out proves that the property is wired up to here. In
        // production, the image engraves the SHA of the delivered commit there.
        mockMvc.perform(get("/api/version").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("dev"));
    }

    @Test
    void la_documentation_de_l_api_est_une_carte_des_routes_donc_elle_se_ferme_aussi() throws Exception {
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------- What is open

    @Test
    void un_lien_de_partage_reste_lisible_par_qui_n_a_pas_de_compte() throws Exception {
        // This is the whole reason for these routes. An unknown token returns 404,
        // which proves that the request did reach the controller.
        mockMvc.perform(get("/api/public/share/jeton-qui-n-existe-pas"))
                .andExpect(status().isNotFound());
    }

    @Test
    void l_etat_de_l_instance_se_lit_sans_compte_puisqu_il_dit_s_il_en_faut_un() throws Exception {
        mockMvc.perform(get("/api/auth/etat"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aucunCompte").exists())
                .andExpect(jsonPath("$.creationOuverte").exists());
    }

    // ------------------------------------------------------------ The login

    @Test
    void creer_le_premier_compte_connecte_du_meme_geste() throws Exception {
        var creation = mockMvc.perform(post("/api/auth/register").with(csrf())
                        .contentType("application/json")
                        .content(json(Map.of("email", "premier@example.com", "motDePasse", "un-mot-de-passe",
                                "pseudo", "Premier"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("premier@example.com"))
                // The hash never goes out to a client.
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.motDePasse").doesNotExist())
                .andReturn();

        mockMvc.perform(get("/api/auth/me").session(sessionOuverte(creation)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("premier@example.com"));
    }

    @Test
    void se_connecter_change_de_session_plutot_que_de_promouvoir_l_ancienne() throws Exception {
        // Session fixation: an identifier obtained BEFORE logging in must
        // never become a connected session. Someone able to set
        // a cookie on the browser of a third person would otherwise wait for them to
        // log in to inherit their session.
        MockHttpSession avant = new MockHttpSession();
        var connexion = mockMvc.perform(post("/api/auth/register").session(avant).with(csrf())
                        .contentType("application/json")
                        .content(json(Map.of("email", "fixation@example.com", "motDePasse", "un-mot-de-passe",
                                "pseudo", "Fixation"))))
                .andExpect(status().isCreated())
                .andReturn();

        assertThat(sessionOuverte(connexion).getId()).isNotEqualTo(avant.getId());
        assertThat(avant.isInvalid()).isTrue();
    }

    @Test
    void une_session_ouverte_donne_acces_a_la_collection() throws Exception {
        MockHttpSession session = connecter();

        mockMvc.perform(get("/api/entities/search").session(session)).andExpect(status().isOk());
    }

    @Test
    void se_deconnecter_referme_vraiment() throws Exception {
        MockHttpSession session = connecter();

        mockMvc.perform(post("/api/auth/logout").session(session).with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/entities/search").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void une_adresse_inconnue_et_un_mot_de_passe_faux_repondent_la_meme_chose() throws Exception {
        connecter();

        String refusPourAdresseInconnue = echecDeConnexion("personne@example.com", "un-mot-de-passe");
        String refusPourMotDePasseFaux = echecDeConnexion("connecte@example.com", "pas-le-bon-passe");

        // Telling the two apart would offer an account existence test.
        assertThat(refusPourAdresseInconnue).isEqualTo(refusPourMotDePasseFaux);
    }

    @Test
    void la_creation_est_fermee_apres_le_premier_compte_faute_de_code_configure() throws Exception {
        connecter();

        mockMvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content(json(Map.of("email", "second@example.com", "motDePasse", "un-mot-de-passe",
                                "pseudo", "Second"))))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ CSRF

    @Test
    void une_ecriture_sans_jeton_est_refusee_meme_avec_une_session_valide() throws Exception {
        // This is exactly the shape of a request triggered by a third-party
        // page: the session cookie goes by itself, the token does not.
        MockHttpSession session = connecter();

        mockMvc.perform(post("/api/auth/logout").session(session))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------ An account that disappears

    @Test
    void un_compte_supprime_perd_sa_session_a_la_requete_suivante() throws Exception {
        // A real session, opened through the door - it is the one that holds the
        // principal, and it is the one that used to survive the deletion of the account.
        MockHttpSession session = connecter();
        String id = objectMapper.readTree(mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asText();

        // Deleted by someone else: an administrator does not delete
        // themselves (see GestionDesComptes), and the route itself has its own
        // tests. What is checked here is what happens to the
        // session, not the administration door.
        gestionDesComptes.supprimer(UUID.fromString(id), UUID.randomUUID());

        // The next request knows nobody anymore: 401, as without
        // a session - and the session is closed, not only refused.
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Ce compte n'existe plus."));
        assertThat(session.isInvalid()).isTrue();
    }

    // ------------------------------------------------------------------ Tools

    /** Creates the first account and returns its open session. */
    private MockHttpSession connecter() throws Exception {
        var creation = mockMvc.perform(post("/api/auth/register").with(csrf())
                        .contentType("application/json")
                        .content(json(Map.of("email", "connecte@example.com", "motDePasse", "un-mot-de-passe",
                                "pseudo", "Connecte"))))
                .andExpect(status().isCreated())
                .andReturn();
        return sessionOuverte(creation);
    }

    /**
     * The session that the response has just opened.
     * <p>
     * Logging in opens a NEW one (protection against session
     * fixation): staying on the object passed as input would mean following a
     * stale cookie. A browser, for its part, follows the {@code Set-Cookie}.
     */
    private static MockHttpSession sessionOuverte(org.springframework.test.web.servlet.MvcResult resultat) {
        return (MockHttpSession) resultat.getRequest().getSession(false);
    }

    private String echecDeConnexion(String email, String motDePasse) throws Exception {
        return mockMvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                        .content(json(Map.of("email", email, "motDePasse", motDePasse))))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getErrorMessage();
    }
}
