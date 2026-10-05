package com.iozycore.integration.http;

import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.http.MediaType.APPLICATION_JSON;

/**
 * <b>Reading the tags is open; setting them is not.</b>
 *
 * <p>A tag describes a <b>work</b>, and so lives in the shared catalogue -
 * a work is the same for everyone, and so is its label. This is
 * exactly what makes writing dangerous: without this rule, any
 * account would label the works of all the others, and nothing on the screen
 * would show it.
 *
 * <p>Reading, for its part, must stay open: it is what feeds the filter
 * of My collection, and closing it would empty this screen without a word.
 */
class TagsAdministresHttpContractTest extends HttpContractTestBase {

    @Autowired
    private TagRepository tags;

    private Tag unTag() {
        return tags.save(new Tag(UUID.randomUUID(), "seinen-" + UUID.randomUUID().toString().substring(0, 8)));
    }

    @Test
    void tout_compte_connecte_peut_LIRE_les_tags() throws Exception {
        // The default identity of this suite is not an administrator.
        mockMvc.perform(get("/api/tags")).andExpect(status().isOk());
    }

    @Test
    void un_compte_ordinaire_ne_peut_ni_creer_ni_renommer_ni_supprimer() throws Exception {
        Tag tag = unTag();

        mockMvc.perform(post("/api/tags").contentType(APPLICATION_JSON).content(json(Map.of("label", "shonen"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/tags/" + tag.id()).contentType(APPLICATION_JSON)
                        .content(json(Map.of("label", "autre"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/tags/" + tag.id())).andExpect(status().isForbidden());
    }

    @Test
    void un_compte_ordinaire_ne_peut_pas_etiqueter_une_oeuvre() throws Exception {
        // The most common action, and the one that would be seen the least: sticking
        // a label on the work of someone else.
        Tag tag = unTag();

        mockMvc.perform(post("/api/tags/entities/" + ABSENT + "/" + tag.id())).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/tags/entities/" + ABSENT + "/" + tag.id())).andExpect(status().isForbidden());
    }

    @Test
    void un_administrateur_renomme_et_supprime() throws Exception {
        Tag tag = unTag();
        String neuf = "seinen-" + UUID.randomUUID().toString().substring(0, 8);

        mockMvc.perform(patch("/api/tags/" + tag.id()).with(user(IDENTITE_ADMIN)).contentType(APPLICATION_JSON)
                        .content(json(Map.of("label", neuf))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value(neuf));

        mockMvc.perform(delete("/api/tags/" + tag.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNoContent());
        // And it does not come back: a deletion that answers 204 without erasing
        // reads like a successful deletion.
        mockMvc.perform(delete("/api/tags/" + tag.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deux_tags_ne_peuvent_pas_porter_le_meme_nom() throws Exception {
        Tag premier = unTag();
        Tag second = unTag();

        mockMvc.perform(patch("/api/tags/" + second.id()).with(user(IDENTITE_ADMIN)).contentType(APPLICATION_JSON)
                        .content(json(Map.of("label", premier.label()))))
                .andExpect(status().isConflict());
    }

    @Test
    void un_libelle_vide_est_refuse_avec_une_phrase() throws Exception {
        Tag tag = unTag();

        mockMvc.perform(patch("/api/tags/" + tag.id()).with(user(IDENTITE_ADMIN)).contentType(APPLICATION_JSON)
                        .content(json(Map.of("label", "   "))))
                .andExpect(status().isBadRequest());
    }
}
