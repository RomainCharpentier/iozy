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
    void on_entre_sans_compte_et_sans_que_personne_ait_rien_a_faire() throws Exception {
        // Aucun reglage, aucune condition : la visite est un fait, pas une
        // option. Meme sur une instance vierge - il n'y a rien a autoriser.
        mockMvc.perform(post("/api/auth/visite").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invite").value(true))
                // Un visiteur n'est personne : ni identifiant, ni adresse.
                .andExpect(jsonPath("$.id").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void la_visite_se_relit_comme_n_importe_quelle_session() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // /me lisait un principal TYPÉ : celui d'une visite y arrivait nul, et
        // la seule route censée dire qui l'on est répondait 401.
        mockMvc.perform(get("/api/auth/me").session(visite))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invite").value(true));
    }

    // ------------------------------------------------------- La lecture seule

    @Test
    void un_visiteur_lit_le_catalogue() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // Le catalogue est partagé : il n'a pas de propriétaire, donc une
        // session qui n'en nomme aucun le voit entièrement.
        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isOk());
        mockMvc.perform(get("/api/entity-types").session(visite)).andExpect(status().isOk());
    }

    @Test
    void un_visiteur_ne_voit_la_collection_de_personne() throws Exception {
        // Un compte existe et possède quelque chose ; le visiteur, lui, ne
        // nomme aucun propriétaire - il ne doit donc voir aucune possession.
        creerLePremierCompte("kenshin");
        MockHttpSession visite = entrerEnVisite();

        mockMvc.perform(get("/api/ownerships").session(visite))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/wishlist").session(visite))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void un_visiteur_n_ecrit_rien_quelle_que_soit_la_route() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // Avec le jeton CSRF, pour que le refus vienne bien de la visite et pas
        // d'un jeton manquant - deux refus différents.
        mockMvc.perform(post("/api/entities").session(visite).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden())
                // La raison est DITE : « Accès refusé » aurait laissé croire à
                // une panne, ou à une erreur de sa part.
                .andExpect(jsonPath("$.error").value(Matchers.containsString("lecture seule")));

        // Régler le partage de son hôte, en particulier : un visiteur n'a rien
        // à décider de ce que son hôte expose.
        mockMvc.perform(patch("/api/share").session(visite).with(csrf())
                        .contentType("application/json").content("{\"shareWishlist\":false}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/share").session(visite).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void un_visiteur_n_atteint_pas_l_administration_de_l_instance() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // Celle-ci est fermée par le RÔLE et non par la méthode : un GET aussi
        // doit être refusé, sans quoi la liste des comptes de l'instance se
        // lirait depuis une porte ouverte à tout Internet.
        mockMvc.perform(get("/api/admin/comptes").session(visite)).andExpect(status().isForbidden());
    }

    @Test
    void un_visiteur_peut_toujours_sortir() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // La déconnexion est un POST : sans son exception explicite, le refus
        // d'écriture aurait enfermé le visiteur dans la collection d'un autre
        // jusqu'à expiration de sa session.
        mockMvc.perform(post("/api/auth/logout").session(visite).with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isUnauthorized());
    }


    // ------------------------------------------------------------------ Outils

    /**
     * Crée le premier compte et rend sa session.
     * <p>
     * Rien de plus : sa collection est visitable du seul fait qu'il existe.
     * Ce helper a coché puis décoché une case, au fil de deux versions ; elle
     * n'existe plus, et c'est tout le sujet.
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
