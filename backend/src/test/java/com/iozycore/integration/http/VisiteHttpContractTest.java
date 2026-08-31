package com.iozycore.integration.http;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.integration.PostgresIntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * <b>La porte ouverte : entrer sans compte, et ne rien pouvoir écrire.</b>
 *
 * <p>C'est le seul endroit de l'application où quelqu'un obtient une session
 * <b>sans rien présenter</b>. Deux erreurs y sont possibles, et aucune ne se
 * voit à l'écran : une porte qui s'ouvre alors que personne ne l'a ouverte, et
 * un visiteur qui écrit dans la collection de son hôte.
 *
 * <h2>Le refus d'écriture se vérifie PAR LA MÉTHODE, sur plusieurs routes</h2>
 * La règle n'est pas « telle route est interdite » mais « tout ce qui n'est pas
 * un GET l'est » (voir SecurityConfig). Un test route par route se serait
 * périmé au premier contrôleur ajouté ; ceux-ci prennent donc un échantillon
 * délibérément varié - écrire dans la collection, régler le partage de son
 * hôte, supprimer - pour montrer que le refus ne dépend d'aucune liste.
 */
@AutoConfigureMockMvc
class VisiteHttpContractTest extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ------------------------------------------------- Ce qui ouvre la porte

    @Test
    void personne_n_entre_sur_une_instance_sans_aucun_compte() throws Exception {
        // Pas de compte, donc pas de collection - il n'y a rien à visiter, et
        // « permitAll » sur la route n'ouvre pas la porte pour autant.
        mockMvc.perform(get("/api/auth/etat"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visiteOuverte").value(false));
        mockMvc.perform(post("/api/auth/visite").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void un_compte_suffit_a_rendre_sa_collection_visitable_sans_qu_il_ait_rien_fait() throws Exception {
        // C'est le sens de l'inversion : la case sert a REFERMER. Exiger un
        // geste prealable, c'etait exactement l'autorisation dont on ne voulait
        // pas devant l'ecran de connexion.
        creerLePremierCompte("kenshin");

        mockMvc.perform(get("/api/auth/etat")).andExpect(jsonPath("$.visiteOuverte").value(true));
        mockMvc.perform(post("/api/auth/visite").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pseudo").value("kenshin"));
    }

    @Test
    void decocher_la_case_referme_pour_de_bon() throws Exception {
        MockHttpSession hote = creerLePremierCompte("kenshin");

        mockMvc.perform(patch("/api/share").session(hote).with(csrf())
                        .contentType("application/json").content("{\"openToGuests\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openToGuests").value(false));

        mockMvc.perform(get("/api/auth/etat")).andExpect(jsonPath("$.visiteOuverte").value(false));
        mockMvc.perform(post("/api/auth/visite").with(csrf())).andExpect(status().isForbidden());
    }

    @Test
    void une_collection_ouverte_laisse_entrer_et_dit_chez_qui_l_on_est() throws Exception {
        creerLePremierCompte("kenshin");

        mockMvc.perform(get("/api/auth/etat")).andExpect(jsonPath("$.visiteOuverte").value(true));

        mockMvc.perform(post("/api/auth/visite").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invite").value(true))
                // Le pseudo de l'HÔTE : un visiteur doit savoir chez qui il est,
                // sans quoi il croit regarder sa propre collection.
                .andExpect(jsonPath("$.pseudo").value("kenshin"))
                // L'adresse de l'hôte, elle, ne le regarde pas.
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void la_visite_se_relit_comme_n_importe_quelle_session() throws Exception {
        creerLePremierCompte("kenshin");
        MockHttpSession visite = entrerEnVisite();

        // /me lisait un principal TYPÉ : celui d'une visite y arrivait nul, et
        // la seule route censée dire qui l'on est répondait 401.
        mockMvc.perform(get("/api/auth/me").session(visite))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invite").value(true));
    }

    // ------------------------------------------------------- La lecture seule

    @Test
    void un_visiteur_lit_la_collection_de_son_hote() throws Exception {
        creerLePremierCompte("kenshin");
        MockHttpSession visite = entrerEnVisite();

        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isOk());
        mockMvc.perform(get("/api/insights/stats").session(visite)).andExpect(status().isOk());
    }

    @Test
    void un_visiteur_n_ecrit_rien_quelle_que_soit_la_route() throws Exception {
        creerLePremierCompte("kenshin");
        MockHttpSession visite = entrerEnVisite();

        // Avec le jeton CSRF, pour que le refus vienne bien de la visite et pas
        // d'un jeton manquant - deux refus différents.
        mockMvc.perform(post("/api/entities").session(visite).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden())
                // La raison est DITE : « Accès refusé » aurait laissé croire à
                // une panne, ou à une erreur de sa part.
                .andExpect(jsonPath("$.error").value(Matchers.containsString("lecture seule")));

        // Régler le partage de son hôte, en particulier : il refermerait la
        // porte derrière lui, ou l'ouvrirait plus grand.
        mockMvc.perform(patch("/api/share").session(visite).with(csrf())
                        .contentType("application/json").content("{\"openToGuests\":false}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/share").session(visite).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void un_visiteur_n_atteint_pas_l_administration_de_l_instance() throws Exception {
        creerLePremierCompte("kenshin");
        MockHttpSession visite = entrerEnVisite();

        // Celle-ci est fermée par le RÔLE et non par la méthode : un GET aussi
        // doit être refusé, sans quoi la liste des comptes de l'instance se
        // lirait depuis une porte ouverte à tout Internet.
        mockMvc.perform(get("/api/admin/comptes").session(visite)).andExpect(status().isForbidden());
    }

    @Test
    void un_visiteur_peut_toujours_sortir() throws Exception {
        creerLePremierCompte("kenshin");
        MockHttpSession visite = entrerEnVisite();

        // La déconnexion est un POST : sans son exception explicite, le refus
        // d'écriture aurait enfermé le visiteur dans la collection d'un autre
        // jusqu'à expiration de sa session.
        mockMvc.perform(post("/api/auth/logout").session(visite).with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isUnauthorized());
    }

    @Test
    void refermer_la_porte_deloge_les_visiteurs_deja_entres() throws Exception {
        MockHttpSession hote = creerLePremierCompte("kenshin");
        MockHttpSession visite = entrerEnVisite();
        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isOk());

        mockMvc.perform(patch("/api/share").session(hote).with(csrf())
                        .contentType("application/json").content("{\"openToGuests\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openToGuests").value(false));

        // Sans revérification à chaque requête, cette session aurait continué
        // de lire jusqu'à son expiration - c'est-à-dire pendant que son hôte
        // croit avoir refermé. Une case qui ne reprend rien n'est pas une case.
        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/visite").with(csrf())).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ Outils

    /**
     * Crée le premier compte et rend sa session.
     * <p>
     * Rien de plus : sa collection est visitable du seul fait qu'il existe.
     * Ce helper cochait auparavant « ouvrir aux visiteurs » - le geste que
     * l'inversion du défaut a précisément supprimé.
     */
    private MockHttpSession creerLePremierCompte(String pseudo) throws Exception {
        MvcResult creation = mockMvc.perform(post("/api/auth/register").with(csrf())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", pseudo + "@example.com", "motDePasse", "un-mot-de-passe",
                                "pseudo", pseudo))))
                .andExpect(status().isCreated())
                .andReturn();

        return sessionOuverte(creation);
    }

    private MockHttpSession entrerEnVisite() throws Exception {
        return sessionOuverte(mockMvc.perform(post("/api/auth/visite").with(csrf()))
                .andExpect(status().isOk())
                .andReturn());
    }

    /** La session que la réponse vient d'ouvrir - entrer en ouvre une neuve. */
    private static MockHttpSession sessionOuverte(MvcResult resultat) {
        return (MockHttpSession) resultat.getRequest().getSession(false);
    }
}
