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
 * Un corps de requête incomplet doit produire un 400 qui nomme le champ
 * manquant, jamais un 500.
 * <p>
 * Cet endpoint était le dernier à avoir échappé à la mise en cohérence des
 * corps invalides : {@code editionTierRanking} ou {@code factorWeights}
 * absents laissaient une collection nulle atteindre un {@code .stream()}, et
 * la réponse d'erreur exposait alors le nom interne de la classe et de sa
 * méthode - une trace technique offerte à l'appelant, sans rien lui dire
 * d'utile.
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
        // Le cas trouvé à l'audit : PATCH avec {} - toutes les collections
        // nulles d'un coup.
        UpdateCollectorPreferencesRequest vide = new UpdateCollectorPreferencesRequest(
                null, false, null, 0, null);

        assertThatThrownBy(() -> controller.updatePreferences(vide))
                .isInstanceOf(ResponseStatusException.class)
                // Le message nomme un champ du contrat public, jamais une classe
                // interne ni une signature de méthode.
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

        // Le refus intervient AVANT toute écriture : un corps invalide ne doit
        // pas laisser le profil à moitié modifié.
        assertThat(controller.preferences().minimumDiscountVsRetailPercent()).isEqualTo(avant);
    }
}
