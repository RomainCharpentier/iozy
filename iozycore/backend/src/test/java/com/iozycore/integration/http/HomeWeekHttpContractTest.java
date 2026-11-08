package com.iozycore.integration.http;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The home page "ta semaine" through HTTP: every block, a custom type on its shelf. */
class HomeWeekHttpContractTest extends HttpContractTestBase {

    @Autowired private QuickAddService quickAddService;
    @Autowired private EntityTypeRepository entityTypeRepository;

    @Test
    void reads_the_week_with_its_blocks() throws Exception {
        String serie = "Vinland Saga " + UUID.randomUUID();
        // Volume 2 owned: volume 1 is a known gap, one missing - almost done.
        UUID series = quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), serie,
                OwnershipCondition.NEW, Map.of(), 2, "Kana").entityId();
        EntityType figurines = entityTypeRepository.save(EntityType.create("FIG_" + UUID.randomUUID()
                .toString().substring(0, 8), "Figurines", Set.of(), Set.of()));
        UUID statue = quickAddService.addNewEntityWithOwnership(figurines.id(), "Totoro " + UUID.randomUUID(),
                OwnershipCondition.NEW).entityId();

        String body = mockMvc.perform(get("/api/home/week"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekStart").isNotEmpty())
                .andExpect(jsonPath("$.weekEnd").isNotEmpty())
                // The work that moved last leads (nothing comes out this week in this database).
                .andExpect(jsonPath("$.une.reason").isNotEmpty())
                .andExpect(jsonPath("$.une.work.entityId").isNotEmpty())
                .andExpect(jsonPath("$.une.elements").isArray())
                .andExpect(jsonPath("$.aussi").isArray())
                .andExpect(jsonPath("$.chiffre.totalObjects").value(greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.chiffre.addedThisMonth").value(greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.chiffre.releasesThisWeek").isNumber())
                .andExpect(jsonPath("$.presqueFini[?(@.work.entityId == '" + series + "')].work.missingCount")
                        .value(1))
                .andExpect(jsonPath("$.presqueFini[?(@.work.entityId == '" + series + "')].missing[0].label")
                        .value("Tome 1"))
                .andExpect(jsonPath("$.presqueFini[?(@.work.entityId == '" + series + "')].missing[0].state")
                        .value("MISSING"))
                .andExpect(jsonPath("$.rayons[?(@.entityTypeId == '" + figurines.id() + "')].workCount").value(1))
                .andExpect(jsonPath("$.rayons[?(@.entityTypeId == '" + figurines.id() + "')].objectCount").value(1))
                .andExpect(jsonPath("$.rayons[?(@.entityTypeId == '" + figurines.id() + "')].covers").isArray())
                .andReturn().getResponse().getContentAsString();
        System.out.println("GET /api/home/week -> " + body.substring(0, Math.min(body.length(), 800)));

        String weekStart = com.jayway.jsonpath.JsonPath.read(body, "$.weekStart");
        String weekEnd = com.jayway.jsonpath.JsonPath.read(body, "$.weekEnd");
        assertThat(LocalDate.parse(weekStart).getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(LocalDate.parse(weekEnd)).isEqualTo(LocalDate.parse(weekStart).plusDays(6));
        assertThat(statue).isNotNull();
    }
}
