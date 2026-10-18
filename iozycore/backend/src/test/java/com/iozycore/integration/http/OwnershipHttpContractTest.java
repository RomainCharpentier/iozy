package com.iozycore.integration.http;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of {@code /api/ownerships}, locked at the level where it lives:
 * the request.
 *
 * <h2>Why these tests exist</h2>
 * The seven routes of this controller had no test going through the web
 * layer. The business rules - we do not restore a copy that is already active, we do not
 * sell twice - are checked elsewhere; what was not checked is
 * their <b>translation into HTTP status</b>. An {@code IllegalStateException}
 * arriving as a 500 rather than a 409 was discovered in the interface.
 *
 * <h2>What is deliberately absent</h2>
 * No re-test of the domain invariants: we do not check <i>that</i> the
 * status changes to SOLD, but that the change is translated into the right code and the
 * right body. The rule belongs to the domain, its HTTP mapping belongs here.
 */
class OwnershipHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private OwnershipRepository ownershipRepository;

    /**
     * A real ownership, created by the only path that creates them in
     * the application. No home-made factory: we start from the state that normal
     * use produces.
     */
    private Ownership unExemplaire() {
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Berserk " + UUID.randomUUID(), OwnershipCondition.USED,
                Map.of(), 1, "Standard");
        return ownershipRepository.findByEntityId(result.entityId()).get(0);
    }

    // ==================================================== GET /api/ownerships

    @Test
    void lists_ownerships_of_one_entity_and_serialises_the_full_contract() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(get("/api/ownerships").param("entityId", exemplaire.entityId().toString()))
                .andExpect(status().isOk())
                // The contract, not only the 200: each field below is
                // read by the client, and a silent rename would break the screen.
                .andExpect(jsonPath("$[0].id").value(exemplaire.id().toString()))
                .andExpect(jsonPath("$[0].entityId").value(exemplaire.entityId().toString()))
                .andExpect(jsonPath("$[0].variantId").exists())
                .andExpect(jsonPath("$[0].condition").value("USED"))
                .andExpect(jsonPath("$[0].status").value("OWNED"))
                .andExpect(jsonPath("$[0].acquiredAt").isNotEmpty());
    }

    @Test
    void returns_an_empty_list_rather_than_404_for_an_entity_without_ownership() throws Exception {
        // Catalogue != Collection: a work without ownership is a normal case,
        // not an error. A 404 here would break the detail page of a wished work.
        mockMvc.perform(get("/api/ownerships").param("entityId", ABSENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void rejects_a_malformed_entity_id_filter_with_400_and_never_500() throws Exception {
        mockMvc.perform(get("/api/ownerships").param("entityId", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    // ============================================ sell / lose / restore

    @Test
    void marks_an_ownership_sold_then_restores_it_through_http() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(post("/api/ownerships/{id}/sell", exemplaire.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SOLD"))
                .andExpect(jsonPath("$.id").value(exemplaire.id().toString()));

        // "Undo" right after marking as sold - the real journey.
        mockMvc.perform(post("/api/ownerships/{id}/restore", exemplaire.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OWNED"));

        assertThat(ownershipRepository.findById(exemplaire.id()).orElseThrow().status())
                .isEqualTo(OwnershipStatus.OWNED);
    }

    @Test
    void marks_an_ownership_lost_through_http() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(post("/api/ownerships/{id}/lose", exemplaire.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LOST"));
    }

    @Test
    void returns_409_when_selling_an_ownership_that_is_no_longer_active() throws Exception {
        Ownership exemplaire = unExemplaire();
        mockMvc.perform(post("/api/ownerships/{id}/sell", exemplaire.id())).andExpect(status().isOk());

        // THE point of these tests: a violated business rule is a conflict, not a
        // server defect. IllegalStateException -> 409, via ApiExceptionHandler.
        mockMvc.perform(post("/api/ownerships/{id}/sell", exemplaire.id()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void returns_409_when_restoring_an_ownership_that_is_already_active() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(post("/api/ownerships/{id}/restore", exemplaire.id()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void returns_404_on_sell_lose_and_restore_when_the_ownership_does_not_exist() throws Exception {
        // The three go through the same findOrThrow: one case each is enough to
        // prove that the path is wired up, without tripling the same assertion.
        for (String action : new String[] {"sell", "lose", "restore"}) {
            mockMvc.perform(post("/api/ownerships/{id}/{action}", ABSENT, action))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void rejects_a_malformed_ownership_id_with_400_and_never_500() throws Exception {
        mockMvc.perform(post("/api/ownerships/{id}/sell", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    // ====================================================== DELETE

    @Test
    void deletes_an_ownership_without_touching_its_variant() throws Exception {
        Ownership exemplaire = unExemplaire();
        UUID variantId = exemplaire.variantId().orElseThrow();

        mockMvc.perform(delete("/api/ownerships/{id}", exemplaire.id()))
                .andExpect(status().isNoContent());

        assertThat(ownershipRepository.findById(exemplaire.id())).isEmpty();
        // Deleting a copy is not deleting the volume: the Variant
        // survives, otherwise the catalogue would empty itself at each resale.
        assertThat(variantId).isNotNull();
        mockMvc.perform(get("/api/entities/{id}", exemplaire.entityId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variants[0].id").value(variantId.toString()));
    }

    @Test
    void deleting_an_ownership_twice_stays_204_because_the_route_is_idempotent() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(delete("/api/ownerships/{id}", exemplaire.id())).andExpect(status().isNoContent());
        // Existing contract: the second deletion does not become an error again.
        // Locked here because a client that replays an action offline
        // depends on it, and a later 404 would be a silent change.
        mockMvc.perform(delete("/api/ownerships/{id}", exemplaire.id())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/ownerships/{id}", ABSENT)).andExpect(status().isNoContent());
    }

    // ============================================== Several copies

    @Test
    void allows_several_ownerships_on_the_same_variant() throws Exception {
        // A collector can own the same volume twice - one read, one
        // new under blister. Nothing in the HTTP layer must assume
        // "1 Variant = 1 Ownership": the list must return two, on the
        // same variantId.
        String titre = "Vagabond " + UUID.randomUUID();
        QuickAddService.QuickAddResult premier = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), titre, OwnershipCondition.USED, Map.of(), 1, "Standard");
        QuickAddService.QuickAddResult second = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), titre, OwnershipCondition.NEW, Map.of(), 1, "Standard");

        // Same work, same volume: the second copy attaches to it.
        assertThat(second.entityId()).isEqualTo(premier.entityId());
        assertThat(second.variantId()).isEqualTo(premier.variantId());

        mockMvc.perform(get("/api/ownerships").param("entityId", premier.entityId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].variantId").value(premier.variantId().toString()))
                .andExpect(jsonPath("$[1].variantId").value(premier.variantId().toString()));
    }
}
