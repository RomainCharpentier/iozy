package com.iozycore.integration.http;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The works read model through HTTP: one work, the list, the collector status, the summary. */
class WorkHttpContractTest extends HttpContractTestBase {

    @Autowired private QuickAddService quickAddService;
    @Autowired private EntityTypeRepository entityTypeRepository;
    @Autowired private EntityRepository entityRepository;

    @Test
    void reads_one_series_with_its_volumes_and_counts() throws Exception {
        String serie = "Naruto " + UUID.randomUUID();
        UUID entityId = volume(serie, 2);

        String body = mockMvc.perform(get("/api/works/{id}", entityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityId").value(entityId.toString()))
                .andExpect(jsonPath("$.entityTypeId").value(EntityTypeFixtures.MANGA.id().toString()))
                .andExpect(jsonPath("$.title").value(serie))
                .andExpect(jsonPath("$.collectorStatus").value("ONGOING"))
                .andExpect(jsonPath("$.ownedCount").value(1))
                // No edition total filled in: the total stays unknown.
                .andExpect(jsonPath("$.totalCount").doesNotExist())
                .andExpect(jsonPath("$.totalKnown").value(false))
                // Volume 1 is a known gap before the owned volume 2.
                .andExpect(jsonPath("$.missingCount").value(1))
                .andExpect(jsonPath("$.elements", hasSize(2)))
                .andExpect(jsonPath("$.elements[0].key").value("volume-1"))
                .andExpect(jsonPath("$.elements[0].label").value("Tome 1"))
                .andExpect(jsonPath("$.elements[0].number").value(1))
                .andExpect(jsonPath("$.elements[0].state").value("MISSING"))
                .andExpect(jsonPath("$.elements[0].countedAsMissing").value(true))
                .andExpect(jsonPath("$.elements[1].state").value("OWNED"))
                .andExpect(jsonPath("$.elements[1].variantId").isNotEmpty())
                .andExpect(jsonPath("$.elements[1].ownershipId").isNotEmpty())
                .andExpect(jsonPath("$.lastMovedAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        System.out.println("GET /api/works/{id} -> " + body);
    }

    @Test
    void a_custom_type_reads_through_the_core_default() throws Exception {
        EntityType figurines = entityTypeRepository.save(EntityType.create("FIG_" + UUID.randomUUID()
                .toString().substring(0, 8), "Figurines", Set.of(), Set.of()));
        UUID entityId = quickAddService.addNewEntityWithOwnership(figurines.id(), "Totoro " + UUID.randomUUID(),
                OwnershipCondition.NEW).entityId();

        mockMvc.perform(get("/api/works/{id}", entityId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.elements", hasSize(1)))
                .andExpect(jsonPath("$.elements[0].key").value("work"))
                .andExpect(jsonPath("$.elements[0].state").value("OWNED"))
                .andExpect(jsonPath("$.ownedCount").value(1))
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.totalKnown").value(true));
    }

    @Test
    void lists_the_owned_and_wished_works_with_their_counts() throws Exception {
        String serie = "Bleach " + UUID.randomUUID();
        UUID owned = volume(serie, 1);
        String wishedTitle = "Cascadia " + UUID.randomUUID();
        mockMvc.perform(post("/api/wishlist").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityTypeId", EntityTypeFixtures.BOARD_GAME.id(), "title", wishedTitle))))
                .andExpect(status().isCreated());
        Entity onlyInCatalog = entityRepository.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(),
                "Catalogue seul " + UUID.randomUUID()));

        String body = mockMvc.perform(get("/api/works"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.entityId == '" + owned + "')].ownedCount").value(1))
                .andExpect(jsonPath("$[?(@.entityId == '" + owned + "')].collectorStatus").value("ONGOING"))
                .andExpect(jsonPath("$[?(@.title == '" + wishedTitle + "')].wishedCount").value(1))
                .andExpect(jsonPath("$[?(@.title == '" + wishedTitle + "')].ownedCount").value(0))
                .andExpect(jsonPath("$[?(@.title == '" + wishedTitle + "')].missingCount").value(1))
                .andExpect(jsonPath("$[?(@.entityId == '" + onlyInCatalog.id() + "')]").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        System.out.println("GET /api/works -> " + body.substring(0, Math.min(body.length(), 600)));
    }

    @Test
    void the_collector_status_pauses_the_missing_count_and_refuses_what_it_cannot_read() throws Exception {
        String serie = "One Piece " + UUID.randomUUID();
        UUID entityId = volume(serie, 3);

        String body = mockMvc.perform(put("/api/works/{id}/collector-status", entityId)
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("status", "PAUSED"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityId").value(entityId.toString()))
                .andExpect(jsonPath("$.collectorStatus").value("PAUSED"))
                .andReturn().getResponse().getContentAsString();
        System.out.println("PUT /api/works/{id}/collector-status -> " + body);

        mockMvc.perform(get("/api/works/{id}", entityId))
                .andExpect(jsonPath("$.collectorStatus").value("PAUSED"))
                .andExpect(jsonPath("$.missingCount").value(0))
                .andExpect(jsonPath("$.elements[0].state").value("MISSING"))
                .andExpect(jsonPath("$.elements[0].countedAsMissing").value(false));
        mockMvc.perform(get("/api/works"))
                .andExpect(jsonPath("$[?(@.entityId == '" + entityId + "')].missingCount").value(0));

        mockMvc.perform(put("/api/works/{id}/collector-status", entityId)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"NOPE\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/works/{id}/collector-status", entityId)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/works/{id}/collector-status", ABSENT)
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("status", "DROPPED"))))
                .andExpect(status().isNotFound());
    }

    /** One owned volume of a series, the way the add field stores it. */
    private UUID volume(String serie, int number) {
        return quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), serie, OwnershipCondition.NEW,
                Map.of(), number, "Kana").entityId();
    }

    @Test
    void an_unknown_or_malformed_work_answers_404_or_400() throws Exception {
        mockMvc.perform(get("/api/works/{id}", ABSENT)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/works/{id}", MALFORME)).andExpect(status().isBadRequest());
    }

    @Test
    void the_summary_counts_active_copies_as_objects() throws Exception {
        quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.BOARD_GAME.id(), "Azul " + UUID.randomUUID(),
                OwnershipCondition.NEW);

        String body = mockMvc.perform(get("/api/works/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalObjects").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.addedThisMonth").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.byType[?(@.entityTypeId == '" + EntityTypeFixtures.BOARD_GAME.id()
                        + "')].count").isNotEmpty())
                .andExpect(jsonPath("$.addedThisMonthByType[?(@.entityTypeId == '"
                        + EntityTypeFixtures.BOARD_GAME.id() + "')].count").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        System.out.println("GET /api/works/summary -> " + body);
    }
}
