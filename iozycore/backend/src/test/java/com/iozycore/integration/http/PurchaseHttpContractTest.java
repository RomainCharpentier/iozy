package com.iozycore.integration.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The "to buy" page through HTTP: the budget, the month, the list and "Je l'ai". */
class PurchaseHttpContractTest extends HttpContractTestBase {

    @Autowired private QuickAddService quickAddService;

    private static Map<String, Object> budget(Object amount) {
        Map<String, Object> body = new HashMap<>();
        body.put("monthlyBudget", amount);
        return body;
    }

    @Test
    void the_budget_is_optional_set_and_removed_and_refuses_what_is_not_an_amount() throws Exception {
        mockMvc.perform(put("/api/purchases/budget").contentType(MediaType.APPLICATION_JSON)
                .content(json(budget(null)))).andExpect(status().isOk());
        mockMvc.perform(get("/api/purchases/budget"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyBudget").doesNotExist());

        String body = mockMvc.perform(put("/api/purchases/budget").contentType(MediaType.APPLICATION_JSON)
                        .content(json(budget(150.5))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyBudget").value(150.5))
                .andReturn().getResponse().getContentAsString();
        System.out.println("PUT /api/purchases/budget -> " + body);
        // Saved twice: still one budget, the last amount.
        mockMvc.perform(put("/api/purchases/budget").contentType(MediaType.APPLICATION_JSON)
                .content(json(budget(80)))).andExpect(status().isOk());
        String month = mockMvc.perform(get("/api/purchases/month"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyBudget").value(80.0))
                .andExpect(jsonPath("$.month").value(matchesPattern("\\d{4}-\\d{2}")))
                .andExpect(jsonPath("$.spent").isNumber())
                .andExpect(jsonPath("$.pricedCount").isNumber())
                .andExpect(jsonPath("$.unpricedCount").isNumber())
                .andReturn().getResponse().getContentAsString();
        System.out.println("GET /api/purchases/month -> " + month);

        mockMvc.perform(put("/api/purchases/budget").contentType(MediaType.APPLICATION_JSON)
                .content(json(budget(0)))).andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/purchases/budget").contentType(MediaType.APPLICATION_JSON)
                .content(json(budget(-3)))).andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/purchases/budget").contentType(MediaType.APPLICATION_JSON)
                .content("{\"monthlyBudget\":\"beaucoup\"}")).andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/purchases/budget").contentType(MediaType.APPLICATION_JSON)
                        .content(json(budget(null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monthlyBudget").doesNotExist());
        mockMvc.perform(get("/api/purchases/month")).andExpect(jsonPath("$.monthlyBudget").doesNotExist());
    }

    @Test
    void a_copy_bought_this_month_with_a_price_counts_in_the_month() throws Exception {
        JsonNode before = objectMapper.readTree(mockMvc.perform(get("/api/purchases/month"))
                .andReturn().getResponse().getContentAsString());
        mockMvc.perform(post("/api/entities/quick-add").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityTypeId", EntityTypeFixtures.BOARD_GAME.id(),
                                "title", "Azul " + UUID.randomUUID(), "condition", "NEW", "purchasePrice", 39.9))))
                .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/purchases/month"))
                .andExpect(jsonPath("$.spent").value(
                        before.get("spent").decimalValue().add(new BigDecimal("39.9")).doubleValue()))
                .andExpect(jsonPath("$.pricedCount").value(before.get("pricedCount").asInt() + 1));
    }

    @Test
    void a_wish_is_on_the_list_and_je_l_ai_moves_it_to_the_collection() throws Exception {
        String title = "Cascadia " + UUID.randomUUID();
        String created = mockMvc.perform(post("/api/wishlist").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityTypeId", EntityTypeFixtures.BOARD_GAME.id(), "title", title))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String entityId = objectMapper.readTree(created).get("entityId").asText();

        String list = mockMvc.perform(get("/api/purchases/to-buy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.title == '" + title + "')].kind").value("WISH"))
                .andExpect(jsonPath("$[?(@.title == '" + title + "')].collectorStatus").value("ONGOING"))
                .andExpect(jsonPath("$[?(@.title == '" + title + "')].elements[0].key").value("work"))
                .andExpect(jsonPath("$[?(@.title == '" + title + "')].elements[0].state").value("WANTED"))
                .andReturn().getResponse().getContentAsString();
        System.out.println("GET /api/purchases/to-buy -> " + list.substring(0, Math.min(list.length(), 600)));

        String acquired = mockMvc.perform(post("/api/purchases/acquire").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", entityId, "elementKey", "work"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownershipId").isNotEmpty())
                .andExpect(jsonPath("$.entityId").value(entityId))
                .andExpect(jsonPath("$.wishRemoved").value(true))
                .andReturn().getResponse().getContentAsString();
        System.out.println("POST /api/purchases/acquire -> " + acquired);

        mockMvc.perform(get("/api/purchases/to-buy"))
                .andExpect(jsonPath("$[?(@.title == '" + title + "')]").isEmpty());
        mockMvc.perform(get("/api/works/{id}", entityId))
                .andExpect(jsonPath("$.ownedCount").value(1))
                .andExpect(jsonPath("$.elements[0].state").value("OWNED"));

        mockMvc.perform(post("/api/purchases/acquire").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", entityId, "elementKey", "work"))))
                .andExpect(status().isConflict());
    }

    @Test
    void je_l_ai_on_a_gap_makes_the_volume_exist_in_the_edition_of_its_neighbour() throws Exception {
        String serie = "Vinland Saga " + UUID.randomUUID();
        UUID entityId = quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), serie,
                OwnershipCondition.NEW, Map.of(), 3, "Kana").entityId();

        mockMvc.perform(get("/api/purchases/to-buy"))
                .andExpect(jsonPath("$[?(@.title == '" + serie + "')].kind").value("COMPLETE"))
                .andExpect(jsonPath("$[?(@.title == '" + serie + "')].elements[0].key").value("volume-1"));

        mockMvc.perform(post("/api/purchases/acquire").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", entityId, "elementKey", "volume-1"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.variantId").isNotEmpty())
                .andExpect(jsonPath("$.wishRemoved").value(false));

        mockMvc.perform(get("/api/works/{id}", entityId))
                .andExpect(jsonPath("$.elements[0].key").value("volume-1"))
                .andExpect(jsonPath("$.elements[0].state").value("OWNED"))
                .andExpect(jsonPath("$.ownedCount").value(2));
        mockMvc.perform(get("/api/entities/{id}", entityId))
                .andExpect(jsonPath("$.variants[?(@.attributes.volumeNumber == 1)].attributes.edition")
                        .value("Kana"));
    }

    @Test
    void je_l_ai_refuses_what_it_cannot_find_or_read() throws Exception {
        mockMvc.perform(post("/api/purchases/acquire").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", ABSENT, "elementKey", "work"))))
                .andExpect(status().isNotFound());
        UUID owned = quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.BOARD_GAME.id(),
                "Wingspan " + UUID.randomUUID(), OwnershipCondition.NEW).entityId();
        mockMvc.perform(post("/api/purchases/acquire").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", owned, "elementKey", "volume-99"))))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/purchases/acquire").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityId", owned))))
                .andExpect(status().isBadRequest());
    }
}
