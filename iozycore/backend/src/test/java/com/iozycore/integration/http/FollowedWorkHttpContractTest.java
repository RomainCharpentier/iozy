package com.iozycore.integration.http;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Following a work through the API, and the trinity kept: Owned, Followed, Wish,
 * one state at a time for the WORK - a volume, for its part, changes nothing to its series.
 */
class FollowedWorkHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    @Test
    void follows_a_work_lists_it_and_unfollows_it_idempotently() throws Exception {
        UUID entityId = oeuvreVoulue("Ark Nova " + UUID.randomUUID());

        mockMvc.perform(put("/api/followed-works").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", entityId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityId").value(entityId.toString()))
                .andExpect(jsonPath("$.followedAt").isNotEmpty());
        mockMvc.perform(put("/api/followed-works").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", entityId))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/followed-works"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.entityId == '" + entityId + "')]", hasSize(1)));

        mockMvc.perform(delete("/api/followed-works").param("entityId", entityId.toString()))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/followed-works").param("entityId", entityId.toString()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/followed-works"))
                .andExpect(jsonPath("$[?(@.entityId == '" + entityId + "')]").doesNotExist());
    }

    @Test
    void refuses_to_follow_an_unknown_work_or_nothing_at_all_with_400() throws Exception {
        mockMvc.perform(put("/api/followed-works").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", UUID.randomUUID()))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/followed-works").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void following_removes_the_wish_for_the_work_and_wishing_the_work_removes_the_follow() throws Exception {
        UUID entityId = oeuvreVoulue("Dune Imperium " + UUID.randomUUID());

        mockMvc.perform(put("/api/followed-works").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", entityId))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/wishlist"))
                .andExpect(jsonPath("$[?(@.entityId == '" + entityId + "')]").doesNotExist());

        mockMvc.perform(post("/api/wishlist").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", entityId))))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/followed-works"))
                .andExpect(jsonPath("$[?(@.entityId == '" + entityId + "')]").doesNotExist());
    }

    @Test
    void acquiring_the_work_as_a_whole_ends_the_follow_but_a_volume_of_a_series_does_not() throws Exception {
        String jeu = "Brass Birmingham " + UUID.randomUUID();
        UUID jeuId = oeuvreVoulue(jeu);
        mockMvc.perform(put("/api/followed-works").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", jeuId))))
                .andExpect(status().isOk());
        // The work of a single piece, acquired: owned, so no longer followed.
        quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.BOARD_GAME.id(), jeu, OwnershipCondition.NEW);
        mockMvc.perform(get("/api/followed-works"))
                .andExpect(jsonPath("$[?(@.entityId == '" + jeuId + "')]").doesNotExist());

        // One more volume in a followed series: this is exactly what following means.
        String serie = "Naruto " + UUID.randomUUID();
        UUID serieId = quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), serie + " - Tome 1",
                OwnershipCondition.NEW).entityId();
        mockMvc.perform(put("/api/followed-works").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", serieId))))
                .andExpect(status().isOk());
        quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), serie + " - Tome 2", OwnershipCondition.NEW);
        mockMvc.perform(get("/api/followed-works"))
                .andExpect(jsonPath("$[?(@.entityId == '" + serieId + "')]", hasSize(1)));
    }

    /** A work born from a wish, under this exact title: a detail page without ownership, the simplest starting state. */
    private UUID oeuvreVoulue(String titre) throws Exception {
        String reponse = mockMvc.perform(post("/api/wishlist").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityTypeId", EntityTypeFixtures.BOARD_GAME.id(),
                                "title", titre))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(reponse.replaceAll(".*\"entityId\"\s*:\s*\"([0-9a-f-]{36})\".*", "$1"));
    }
}
