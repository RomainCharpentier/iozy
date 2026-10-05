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
 * <b>The open door: entering without an account, and being unable to write anything.</b>
 *
 * <p>This is the only place of the application where someone gets a session
 * <b>without presenting anything</b>. Two errors are possible there, and none can be
 * seen on the screen: a door that opens when nobody opened it, and
 * a visitor who writes into the collection of their host.
 *
 * <h2>The write refusal is checked BY THE METHOD, on several routes</h2>
 * The rule is not "this route is forbidden" but "everything that is not
 * a GET is" (see SecurityConfig). A route by route test would have become
 * outdated at the first controller added; these therefore take a deliberately
 * varied sample - writing into the collection, setting the sharing of their
 * host, deleting - to show that the refusal does not depend on any list.
 */
@AutoConfigureMockMvc
class VisiteHttpContractTest extends PostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ------------------------------------------------- What opens the door

    @Test
    void on_entre_sans_compte_et_sans_que_personne_ait_rien_a_faire() throws Exception {
        // No setting, no condition: the visit is a fact, not an
        // option. Even on an empty instance - there is nothing to authorise.
        mockMvc.perform(post("/api/auth/visite").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invite").value(true))
                // A visitor is nobody: no identifier, no address.
                .andExpect(jsonPath("$.id").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void la_visite_se_relit_comme_n_importe_quelle_session() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // /me read a TYPED principal: the one of a visit arrived null there, and
        // the only route meant to say who one is answered 401.
        mockMvc.perform(get("/api/auth/me").session(visite))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invite").value(true));
    }

    // ------------------------------------------------------- Read only

    @Test
    void un_visiteur_lit_le_catalogue() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // The catalogue is shared: it has no owner, so a
        // session that names none sees it entirely.
        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isOk());
        mockMvc.perform(get("/api/entity-types").session(visite)).andExpect(status().isOk());
    }

    @Test
    void un_visiteur_ne_voit_la_collection_de_personne() throws Exception {
        // An account exists and owns something; the visitor, for its part, does not
        // name any owner - so it must not see any ownership.
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

        // With the CSRF token, so that the refusal really comes from the visit and not
        // from a missing token - two different refusals.
        mockMvc.perform(post("/api/entities").session(visite).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden())
                // The reason is SAID: "Accès refusé" would have made them believe
                // in a failure, or in an error on their side.
                .andExpect(jsonPath("$.error").value(Matchers.containsString("lecture seule")));

        // Setting the sharing of their host, in particular: a visitor has nothing
        // to decide about what their host exposes.
        mockMvc.perform(patch("/api/share").session(visite).with(csrf())
                        .contentType("application/json").content("{\"shareWishlist\":false}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/share").session(visite).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void un_visiteur_n_atteint_pas_l_administration_de_l_instance() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // This one is closed by the ROLE and not by the method: a GET too
        // must be refused, otherwise the list of the accounts of the instance would
        // be read from a door open to the whole Internet.
        mockMvc.perform(get("/api/admin/comptes").session(visite)).andExpect(status().isForbidden());
    }

    @Test
    void un_visiteur_peut_toujours_sortir() throws Exception {
        MockHttpSession visite = entrerEnVisite();

        // The logout is a POST: without its explicit exception, the write
        // refusal would have locked the visitor inside the collection of someone else
        // until the expiry of their session.
        mockMvc.perform(post("/api/auth/logout").session(visite).with(csrf()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/entities/search").session(visite)).andExpect(status().isUnauthorized());
    }


    // ------------------------------------------------------------------ Tools

    /**
     * Creates the first account and returns its session.
     * <p>
     * Nothing more: its collection is visitable by the sole fact that it exists.
     * This helper ticked then unticked a box, over two versions; it
     * no longer exists, and that is the whole point.
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

    /** The session that the response has just opened - entering opens a new one. */
    private static MockHttpSession sessionOuverte(MvcResult resultat) {
        return (MockHttpSession) resultat.getRequest().getSession(false);
    }
}
