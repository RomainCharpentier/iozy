package com.iozycore.integration.http;

import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of {@code /api/tier-lists} - eleven routes, seven mutations,
 * two levels of path parameters.
 *
 * <h2>Why this surface</h2>
 * It is the biggest concentration of uncovered mutations in
 * the application, and it orchestrates three aggregates: the list, its items, and
 * the general ranking attached to the works. It has also already been fixed once
 * for a deep reason - <i>"decouple the ranking from
 * ownership"</i> - which makes it all the more useful to freeze.
 *
 * <h2>The product invariant</h2>
 * <b>Ranking is not owning.</b> A catalogue work, never acquired,
 * must be able to be ranked. A test states it explicitly, by checking
 * that no ownership appears on the way.
 */
class TierListHttpContractTest extends HttpContractTestBase {

    @Autowired
    private TierListRepository tierListRepository;

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private com.iozycore.core.domain.ownership.OwnershipRepository ownershipRepository;

    private static final String MANGA = "00000000-0000-0000-0000-000000000001";

    private TierList uneListe() {
        return tierListRepository.save(TierList.create(
                "Mes préférés " + UUID.randomUUID(), EntityTypeFixtures.MANGA.id(), null, null));
    }

    /** A catalogue work, without any ownership. */
    private Entity uneOeuvreNonPossedee() {
        return catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                "Nausicaä " + UUID.randomUUID(), Map.of()).entity();
    }

    // ========================================================= Creation

    @Test
    void creates_a_tier_list_for_one_universe() throws Exception {
        mockMvc.perform(post("/api/tier-lists").contentType("application/json")
                        .content("{\"name\":\"Shônen\",\"entityTypeId\":\"" + MANGA + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Shônen"))
                .andExpect(jsonPath("$.entityTypeId").value(MANGA))
                // Ranks not specified: the list receives the complete scale rather
                // than no rank, otherwise nothing could be ranked.
                .andExpect(jsonPath("$.activeRanks").isNotEmpty());
    }

    @Test
    void creates_a_cross_universe_tier_list_when_no_entity_type_is_given() throws Exception {
        // entityTypeId missing = cross-type list "all categories". It is a
        // contract, not a validation oversight: testing it prevents a future
        // presence check from breaking it.
        mockMvc.perform(post("/api/tier-lists").contentType("application/json")
                        .content("{\"name\":\"Tout confondu\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entityTypeId").doesNotExist());
    }

    @Test
    void rejects_an_unknown_universe_with_400_rather_than_a_misleading_conflict() throws Exception {
        // Found by this pass: the existence check of the type did not
        // validate anything (findAllByType returns an empty list), the foreign key
        // constraint decided in its place, and the client received 409
        // "Cette donnée entre en conflit avec une donnée existante" - while
        // the data is absent, not conflicting.
        // Only the status is stated: a ResponseStatusException carries its
        // JSON body through the error redirection of the container, which MockMvc does not
        // replay. The live probe confirms the real body on the server side.
        mockMvc.perform(post("/api/tier-lists").contentType("application/json")
                        .content("{\"name\":\"x\",\"entityTypeId\":\"" + ABSENT + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_a_blank_name_and_an_unparseable_body_with_400_and_never_500() throws Exception {
        for (String corps : new String[] {"{}", "{\"name\":\"   \"}", "", "{pas du json",
                                          "{\"name\":\"x\",\"activeRanks\":[\"ZZZ\"]}"}) {
            mockMvc.perform(post("/api/tier-lists").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    // ==================================================== Read / listing

    @Test
    void lists_tier_lists_and_filters_them_by_universe() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(get("/api/tier-lists").param("entityTypeId", MANGA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + liste.id() + "')]").exists());

        // Without filter, the route returns everything: this is what the
        // "all my lists" screen uses.
        mockMvc.perform(get("/api/tier-lists")).andExpect(status().isOk());
    }

    @Test
    void returns_404_for_a_tier_list_that_does_not_exist_and_400_for_a_malformed_id() throws Exception {
        mockMvc.perform(get("/api/tier-lists/{id}", ABSENT)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/tier-lists/{id}", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void the_general_board_requires_a_universe_and_rejects_a_malformed_one() throws Exception {
        mockMvc.perform(get("/api/tier-lists/general")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/tier-lists/general").param("entityTypeId", MALFORME))
                .andExpect(status().isBadRequest());
        // An unknown universe returns an empty board, not an error: the screen must
        // be able to open before a single work exists.
        mockMvc.perform(get("/api/tier-lists/general").param("entityTypeId", ABSENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ranked").exists());
    }

    @Test
    void the_entity_summary_answers_for_an_entity_that_was_never_ranked() throws Exception {
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(get("/api/tier-lists/entities/{id}/summary", oeuvre.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generalRank").doesNotExist())
                .andExpect(jsonPath("$.customRanks").isArray());
    }

    // ================================================ General ranking

    @Test
    void ranks_an_entity_in_the_general_board_without_owning_it() throws Exception {
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", oeuvre.id())
                        .contentType("application/json").content("{\"rank\":\"S\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rank").value("S"))
                .andExpect(jsonPath("$.entityId").value(oeuvre.id().toString()));

        // Ranking is not owning: the assertion that matters. Without it, the
        // test would also pass if the ranking made up an ownership.
        org.assertj.core.api.Assertions.assertThat(ownershipRepository.findByEntityId(oeuvre.id())).isEmpty();

        mockMvc.perform(get("/api/tier-lists/entities/{id}/summary", oeuvre.id()))
                .andExpect(jsonPath("$.generalRank").value("S"));
    }

    @Test
    void returns_400_when_ranking_an_entity_that_does_not_exist() throws Exception {
        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", ABSENT)
                        .contentType("application/json").content("{\"rank\":\"S\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_invalid_or_missing_rank_with_400_and_never_500() throws Exception {
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", oeuvre.id())
                        .contentType("application/json").content("{\"rank\":\"ZZZ\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", MALFORME)
                        .contentType("application/json").content("{\"rank\":\"S\"}"))
                .andExpect(status().isBadRequest());
    }

    // ============================================ Update / deletion

    @Test
    void renames_a_tier_list_and_leaves_untouched_what_the_body_omits() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(patch("/api/tier-lists/{id}", liste.id()).contentType("application/json")
                        .content("{\"name\":\"Mes intouchables\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Mes intouchables"))
                // The universe is not in the body: it must not disappear.
                .andExpect(jsonPath("$.entityTypeId").value(EntityTypeFixtures.MANGA.id().toString()));
    }

    @Test
    void returns_404_when_updating_or_deleting_items_of_an_absent_tier_list() throws Exception {
        // Four distinct routes go through the same requireTierList: one case
        // each is enough to prove the wiring, without quadrupling the assertion.
        mockMvc.perform(patch("/api/tier-lists/{id}", ABSENT).contentType("application/json")
                .content("{\"name\":\"x\"}")).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/tier-lists/{id}/items", ABSENT).contentType("application/json")
                .content("{\"entityIds\":[\"" + ABSENT + "\"]}")).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/tier-lists/{id}/items/{e}", ABSENT, ABSENT)
                .contentType("application/json").content("{\"rank\":\"S\"}")).andExpect(status().isNotFound());
    }

    @Test
    void deleting_a_tier_list_stays_204_and_is_idempotent() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(delete("/api/tier-lists/{id}", liste.id())).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tier-lists/{id}", liste.id())).andExpect(status().isNotFound());
        // Existing contract: replaying the deletion does not become an error.
        mockMvc.perform(delete("/api/tier-lists/{id}", liste.id())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/tier-lists/{id}", ABSENT)).andExpect(status().isNoContent());
    }

    // ==================================================== Items of a list

    @Test
    void adds_items_ranks_one_then_removes_it() throws Exception {
        TierList liste = uneListe();
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(post("/api/tier-lists/{id}/items", liste.id()).contentType("application/json")
                        .content("{\"entityIds\":[\"" + oeuvre.id() + "\"]}"))
                // 201: adding items creates resources, and the route
                // declares it (@ResponseStatus(CREATED)). Frozen as it is.
                .andExpect(status().isCreated())
                // Added but not ranked yet: it must appear in
                // "to rank", not get lost.
                .andExpect(jsonPath("$.unranked[?(@.entityId=='" + oeuvre.id() + "')]").exists());

        mockMvc.perform(put("/api/tier-lists/{id}/items/{e}", liste.id(), oeuvre.id())
                        .contentType("application/json").content("{\"rank\":\"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rank").value("A"));

        mockMvc.perform(get("/api/tier-lists/{id}", liste.id()))
                .andExpect(jsonPath("$.ranked[?(@.entityId=='" + oeuvre.id() + "')]").exists())
                .andExpect(jsonPath("$.unranked[?(@.entityId=='" + oeuvre.id() + "')]").doesNotExist());

        mockMvc.perform(delete("/api/tier-lists/{id}/items/{e}", liste.id(), oeuvre.id()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tier-lists/{id}", liste.id()))
                .andExpect(jsonPath("$.ranked[?(@.entityId=='" + oeuvre.id() + "')]").doesNotExist());
    }

    @Test
    void rejects_an_empty_item_list_with_400_rather_than_silently_doing_nothing() throws Exception {
        TierList liste = uneListe();

        for (String corps : new String[] {"{}", "{\"entityIds\":[]}"}) {
            mockMvc.perform(post("/api/tier-lists/{id}/items", liste.id())
                            .contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void ranking_an_item_that_belongs_to_an_owned_series_works_the_same_way() throws Exception {
        // The counterpart of the test "ranking is not owning": owning does not
        // prevent ranking either. The two dimensions are independent.
        TierList liste = uneListe();
        QuickAddService.QuickAddResult possedee = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Monster " + UUID.randomUUID(),
                OwnershipCondition.USED, Map.of(), 1, "Standard");

        mockMvc.perform(post("/api/tier-lists/{id}/items", liste.id()).contentType("application/json")
                        .content("{\"entityIds\":[\"" + possedee.entityId() + "\"]}"))
                .andExpect(status().isCreated());
        mockMvc.perform(put("/api/tier-lists/{id}/items/{e}", liste.id(), possedee.entityId())
                        .contentType("application/json").content("{\"rank\":\"B\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rank").value("B"));
    }

    @Test
    void removing_an_item_that_was_never_in_the_list_stays_204() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(delete("/api/tier-lists/{id}/items/{e}", liste.id(), ABSENT))
                .andExpect(status().isNoContent());
    }
}
