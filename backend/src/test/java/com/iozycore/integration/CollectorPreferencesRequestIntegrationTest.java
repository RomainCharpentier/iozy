package com.iozycore.integration;

import com.iozycore.manga.api.PurchaseAnalysisController;
import com.iozycore.manga.api.PurchaseAnalysisController.UpdateCollectorPreferencesRequest;
import com.iozycore.manga.deals.CollectorPreferences;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * An incomplete request body must produce a 400 that names the missing
 * field, never a 500.
 * <p>
 * This endpoint was the last one that missed the work to make invalid
 * bodies consistent: a missing {@code editionTierRanking} or {@code factorWeights}
 * let a null collection reach a {@code .stream()}, and
 * the error response then exposed the internal name of the class and of its
 * method - a technical trace given to the caller, without telling it
 * anything useful.
 */
class CollectorPreferencesRequestIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private PurchaseAnalysisController controller;

    private static UpdateCollectorPreferencesRequest complete() {
        return new UpdateCollectorPreferencesRequest(List.of("PERFECT", "STANDARD"), true, "HIGH", 30,
                Map.of("CONDITION", 8));
    }

    @Test
    void un_corps_complet_est_accepte() {
        CollectorPreferences preferences = controller.updatePreferences(complete());

        assertThat(preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced()).isTrue();
        assertThat(preferences.minimumDiscountVsRetailPercent()).isEqualTo(30);
    }

    @Test
    void un_classement_d_editions_absent_donne_un_400_qui_nomme_le_champ() {
        UpdateCollectorPreferencesRequest sansClassement = new UpdateCollectorPreferencesRequest(null, true, "HIGH", 30, Map.of());

        assertThatThrownBy(() -> controller.updatePreferences(sansClassement))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("editionTierRanking")
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void des_poids_de_facteurs_absents_donnent_un_400_qui_nomme_le_champ() {
        UpdateCollectorPreferencesRequest sansPoids = new UpdateCollectorPreferencesRequest(
                List.of("STANDARD"), true, "HIGH", 30, null);

        assertThatThrownBy(() -> controller.updatePreferences(sansPoids))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("factorWeights")
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void un_corps_entierement_vide_est_refuse_sans_trace_technique() {
        // The case found during the audit: PATCH with {} - all the collections
        // null at once.
        UpdateCollectorPreferencesRequest vide = new UpdateCollectorPreferencesRequest(
                null, false, null, 0, null);

        assertThatThrownBy(() -> controller.updatePreferences(vide))
                .isInstanceOf(ResponseStatusException.class)
                // The message names a field of the public contract, never an internal class
                // or a method signature.
                .hasMessageContaining("editionTierRanking")
                .hasMessageNotContaining("PurchaseAnalysisController")
                .hasMessageNotContaining("Cannot invoke");
    }

    @Test
    void une_valeur_d_enum_invalide_reste_un_400_lisible() {
        UpdateCollectorPreferencesRequest mauvaisRang = new UpdateCollectorPreferencesRequest(
                List.of("EDITION_INEXISTANTE"), true, "HIGH", 30, Map.of());

        assertThatThrownBy(() -> controller.updatePreferences(mauvaisRang))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("editionTierRanking");
    }

    @Test
    void un_corps_refuse_ne_modifie_pas_les_preferences_enregistrees() {
        controller.updatePreferences(complete());
        int avant = controller.preferences().minimumDiscountVsRetailPercent();

        assertThatThrownBy(() -> controller.updatePreferences(new UpdateCollectorPreferencesRequest(
                null, false, "HIGH", 99, Map.of())))
                .isInstanceOf(ResponseStatusException.class);

        // The refusal happens BEFORE any write: an invalid body must not
        // leave the profile half modified.
        assertThat(controller.preferences().minimumDiscountVsRetailPercent()).isEqualTo(avant);
    }
}
