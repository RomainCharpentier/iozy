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
 * Le contrat HTTP de {@code /api/insights/progress/{entityId}} - la
 * progression d'UNE œuvre.
 *
 * <h2>Pourquoi cette route existe</h2>
 * « X tomes possédés sur Y » se calculait à trois endroits. Ma collection a
 * cessé de le refaire au Lot 51, la fiche au Lot 60 - mais la fiche n'a besoin
 * que d'une œuvre, et {@code /insights/progress} les rend toutes. C'est le seul
 * ajout du lot : la règle, elle, ne bouge pas d'un pouce (voir
 * {@code CollectionProgressServiceTest}, qui la couvre).
 *
 * <h2>Ce que ces tests figent</h2>
 * La forme rendue - le client s'en sert pour construire sa grille sans rien
 * re-dériver - et le 404 sur une œuvre inconnue, qui ne doit jamais devenir une
 * progression vide : « aucun tome » et « aucune œuvre » n'appellent pas le même
 * écran.
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
                // Les trois listes que la grille lit : possédés, catalogués, et
                // les éditions brutes couvertes par le groupe affiché.
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
