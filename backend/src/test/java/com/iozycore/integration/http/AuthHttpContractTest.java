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
 * <b>La porte elle-même.</b>
 *
 * <p>Tous les autres tests de contrat partent au nom d'un compte connecté (voir
 * {@link RequetesAuthentifiees}) : ils vérifient ce que fait l'application
 * <i>une fois qu'on est entré</i>. Celui-ci fait l'inverse - il frappe en
 * <b>anonyme</b>, et vérifie ce qui s'ouvre et ce qui se ferme.
 *
 * <h2>Ce qui est en jeu</h2>
 * Une route oubliée dans la liste des exceptions, et c'est toute une collection
 * lisible par qui trouve l'adresse. Une route de trop protégée, et un lien de
 * partage cesse de fonctionner pour son destinataire - qui, lui, n'a pas de
 * compte et n'en aura jamais. Les deux erreurs sont silencieuses : rien dans
 * l'application ne change d'aspect.
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

    // ------------------------------------------------------- Ce qui est fermé

    @Test
    void une_collection_ne_se_lit_pas_sans_compte() throws Exception {
        mockMvc.perform(get("/api/entities/search")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/ownerships")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/insights/stats")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/wishlist")).andExpect(status().isUnauthorized());
    }

    @Test
    void une_ecriture_anonyme_n_atteint_jamais_le_controleur() throws Exception {
        // Avec le jeton CSRF, pour que le refus vienne bien de l'absence de
        // compte et pas d'un jeton manquant - deux refus différents.
        mockMvc.perform(post("/api/entities").with(csrf()).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void la_version_du_serveur_ne_se_lit_pas_avant_de_s_etre_connecte() throws Exception {
        // Connaître la version exacte d'un serveur sert autant à l'exploiter
        // qu'à l'attaquer, et personne n'a besoin de la lire AVANT d'entrer :
        // elle s'affiche dans les Paramètres, pas sur la porte.
        mockMvc.perform(get("/api/version")).andExpect(status().isUnauthorized());
    }

    @Test
    void une_fois_connecte_la_version_dit_quelle_livraison_tourne() throws Exception {
        MockHttpSession session = connecter();

        // « dev » hors conteneur : c'est la valeur par défaut, et le fait
        // qu'elle sorte prouve que la propriété est bien câblée jusqu'ici. En
        // production, l'image y grave le SHA du commit livré.
        mockMvc.perform(get("/api/version").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("dev"));
    }

    @Test
    void la_documentation_de_l_api_est_une_carte_des_routes_donc_elle_se_ferme_aussi() throws Exception {
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------- Ce qui est ouvert

    @Test
    void un_lien_de_partage_reste_lisible_par_qui_n_a_pas_de_compte() throws Exception {
        // C'est toute la raison d'être de ces routes. Un jeton inconnu rend 404,
        // ce qui prouve que la requête a bien atteint le contrôleur.
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

    // ------------------------------------------------------------ La connexion

    @Test
    void creer_le_premier_compte_connecte_du_meme_geste() throws Exception {
        var creation = mockMvc.perform(post("/api/auth/register").with(csrf())
                        .contentType("application/json")
                        .content(json(Map.of("email", "premier@example.com", "motDePasse", "un-mot-de-passe",
                                "pseudo", "Premier"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("premier@example.com"))
                // Le hachage ne sort jamais vers un client.
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.motDePasse").doesNotExist())
                .andReturn();

        mockMvc.perform(get("/api/auth/me").session(sessionOuverte(creation)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("premier@example.com"));
    }

    @Test
    void se_connecter_change_de_session_plutot_que_de_promouvoir_l_ancienne() throws Exception {
        // Fixation de session : un identifiant obtenu AVANT de se connecter ne
        // doit jamais devenir une session connectée. Quelqu'un capable de poser
        // un cookie sur le navigateur d'un tiers attendrait sinon qu'il se
        // connecte pour hériter de sa session.
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

        // Distinguer les deux offrirait un test d'existence de compte.
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
        // C'est exactement la forme d'une requête déclenchée par une page
        // tierce : le cookie de session part tout seul, le jeton non.
        MockHttpSession session = connecter();

        mockMvc.perform(post("/api/auth/logout").session(session))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------ Un compte qui disparaît

    @Test
    void un_compte_supprime_perd_sa_session_a_la_requete_suivante() throws Exception {
        // Une vraie session, ouverte par la porte - c'est elle qui retient le
        // principal, et c'est elle qui survivait à la suppression du compte.
        MockHttpSession session = connecter();
        String id = objectMapper.readTree(mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asText();

        // Supprimé par quelqu'un d'autre : un administrateur ne se supprime
        // pas lui-même (voir GestionDesComptes), et la route elle-même a ses
        // propres tests. Ce qui se vérifie ici, c'est ce qu'il advient de la
        // session, pas de la porte d'administration.
        gestionDesComptes.supprimer(UUID.fromString(id), UUID.randomUUID());

        // La requête suivante ne connaît plus personne : 401, comme sans
        // session - et la session est fermée, pas seulement refusée.
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Ce compte n'existe plus."));
        assertThat(session.isInvalid()).isTrue();
    }

    // ------------------------------------------------------------------ Outils

    /** Crée le premier compte et rend sa session ouverte. */
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
     * La session que la réponse vient d'ouvrir.
     * <p>
     * Se connecter en ouvre une NEUVE (protection contre la fixation de
     * session) : rester sur l'objet passé en entrée reviendrait à suivre un
     * cookie périmé. Un navigateur, lui, suit le {@code Set-Cookie}.
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
