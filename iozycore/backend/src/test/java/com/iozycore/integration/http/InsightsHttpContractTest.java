package com.iozycore.integration.http;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of {@code /api/insights/progress/{entityId}} - the
 * progress of ONE work.
 *
 * <h2>Why this route exists</h2>
 * "X volumes owned out of Y" used to be computed in three places. My collection
 * stopped redoing it in Batch 51, the detail page in Batch 60 - but the detail page only needs
 * one work, and {@code /insights/progress} returns them all. This is the only
 * addition of the batch: the rule itself does not move by an inch (see
 * {@code CollectionProgressServiceTest}, which covers it).
 *
 * <h2>What these tests freeze</h2>
 * The returned shape - the client uses it to build its grid without
 * re-deriving anything - and the 404 on an unknown work, which must never become an
 * empty progress: "no volume" and "no work" do not call for the same
 * screen.
 */
class InsightsHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    @Test
    void serves_the_progress_of_a_single_work_with_everything_its_page_needs() throws Exception {
        QuickAddService.QuickAddResult resultat = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Naruto " + UUID.randomUUID(), OwnershipCondition.USED,
                Map.of(), 3, "Kana");

        mockMvc.perform(get("/api/insights/progress/" + resultat.entityId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityId").value(resultat.entityId().toString()))
                .andExpect(jsonPath("$.ownedVolumeCount").value(1))
                .andExpect(jsonPath("$.editions[0].editionName").value("Kana"))
                // The three lists that the grid reads: owned, catalogued, and
                // the raw editions covered by the displayed group.
                .andExpect(jsonPath("$.editions[0].ownedVolumeNumbers[0]").value(3))
                .andExpect(jsonPath("$.editions[0].cataloguedVolumeNumbers[0]").value(3))
                .andExpect(jsonPath("$.editions[0].sourceEditions[0]").value("Kana"));
    }

    @Test
    void answers_404_for_an_unknown_work_rather_than_an_empty_progress() throws Exception {
        mockMvc.perform(get("/api/insights/progress/" + ABSENT))
                .andExpect(status().isNotFound());
    }

    @Test
    void answers_400_for_an_identifier_that_is_not_a_uuid() throws Exception {
        mockMvc.perform(get("/api/insights/progress/" + MALFORME))
                .andExpect(status().isBadRequest());
    }
}
