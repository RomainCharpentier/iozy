package com.iozycore.integration.http;

import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
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
 * <b>Lire les tags est ouvert ; les poser ne l'est pas.</b>
 *
 * <p>Un tag décrit une <b>œuvre</b>, et vit donc dans le catalogue partagé —
 * une œuvre est la même pour tout le monde, et son étiquette aussi. C'est
 * exactement ce qui rend l'écriture dangereuse : sans cette règle, n'importe
 * quel compte étiquetterait les œuvres de tous les autres, et rien à l'écran
 * ne le montrerait.
 *
 * <p>La lecture, elle, doit rester ouverte : c'est elle qui alimente le filtre
 * de Ma collection, et la fermer viderait cet écran sans un mot.
 */
class TagsAdministresHttpContractTest extends HttpContractTestBase {

    @Autowired
    private TagRepository tags;

    private Tag unTag() {
        return tags.save(new Tag(UUID.randomUUID(), "seinen-" + UUID.randomUUID().toString().substring(0, 8)));
    }

    @Test
    void tout_compte_connecte_peut_LIRE_les_tags() throws Exception {
        // L'identité par défaut de cette suite n'est pas administratrice.
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
        // Le geste le plus courant, et celui qui se verrait le moins : coller
        // une étiquette sur l'œuvre de quelqu'un d'autre.
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
        // Et il ne revient pas : une suppression qui répond 204 sans effacer se
        // lit comme une suppression réussie.
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
