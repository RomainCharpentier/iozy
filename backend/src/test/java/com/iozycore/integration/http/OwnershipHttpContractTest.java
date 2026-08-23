package com.iozycore.integration.http;

import com.iozycore.application.QuickAddService;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.ownership.OwnershipStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le contrat HTTP de {@code /api/ownerships}, verrouillé au niveau où il vit :
 * la requête.
 *
 * <h2>Pourquoi ces tests existent</h2>
 * Les sept routes de ce contrôleur n'avaient aucun test traversant la couche
 * web. Les règles métier - on ne restaure pas un exemplaire déjà actif, on ne
 * vend pas deux fois - sont vérifiées ailleurs ; ce qui ne l'était pas, c'est
 * leur <b>traduction en status HTTP</b>. Un {@code IllegalStateException}
 * arrivant en 500 plutôt qu'en 409 se découvrait dans l'interface.
 *
 * <h2>Ce qui est délibérément absent</h2>
 * Pas de re-test des invariants de domaine : on n'y vérifie pas <i>que</i> le
 * statut passe à VENDU, mais que le passage se traduit par le bon code et le
 * bon corps. La règle appartient au domaine, sa mise en HTTP appartient ici.
 */
class OwnershipHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private OwnershipRepository ownershipRepository;

    /**
     * Une possession réelle, créée par le seul chemin qui en crée dans
     * l'application. Pas de fabrique maison : on part de l'état que produit
     * l'usage normal.
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
                // Le contrat, pas seulement le 200 : chaque champ ci-dessous est
                // lu par le client, et un renommage silencieux casserait l'écran.
                .andExpect(jsonPath("$[0].id").value(exemplaire.id().toString()))
                .andExpect(jsonPath("$[0].entityId").value(exemplaire.entityId().toString()))
                .andExpect(jsonPath("$[0].variantId").exists())
                .andExpect(jsonPath("$[0].condition").value("USED"))
                .andExpect(jsonPath("$[0].status").value("OWNED"))
                .andExpect(jsonPath("$[0].acquiredAt").isNotEmpty());
    }

    @Test
    void returns_an_empty_list_rather_than_404_for_an_entity_without_ownership() throws Exception {
        // Catalogue != Collection : une œuvre sans possession est un cas normal,
        // pas une erreur. Un 404 ici casserait la fiche d'une œuvre souhaitée.
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

        // « Annuler » juste après avoir marqué vendu - le parcours réel.
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

        // LE point de ces tests : une règle métier violée est un conflit, pas un
        // défaut serveur. IllegalStateException -> 409, via ApiExceptionHandler.
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
        // Les trois passent par le même findOrThrow : un cas chacun suffit à
        // prouver que le chemin est bien câblé, sans tripler la même assertion.
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

    // ============================================== PATCH note / purchase-price

    @Test
    void updates_the_note_and_returns_the_updated_resource() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(patch("/api/ownerships/{id}/note", exemplaire.id())
                        .contentType("application/json")
                        .content(json(Map.of("note", "Jaquette abîmée"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.note").value("Jaquette abîmée"));
    }

    @Test
    void accepts_a_null_note_because_erasing_a_note_is_a_legitimate_correction() throws Exception {
        Ownership exemplaire = unExemplaire();

        // Le corps {} donne note = null. Ce n'est pas une erreur de saisie :
        // le domaine l'autorise explicitement, et l'API doit suivre plutôt
        // qu'inventer une contrainte que le métier n'impose pas.
        mockMvc.perform(patch("/api/ownerships/{id}/note", exemplaire.id())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.note").doesNotExist());
    }

    @Test
    void updates_then_erases_the_purchase_price() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(patch("/api/ownerships/{id}/purchase-price", exemplaire.id())
                        .contentType("application/json")
                        .content(json(Map.of("purchasePrice", new BigDecimal("7.65")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchasePrice").value(7.65));

        // null efface, volontairement : une Ownership peut redevenir « prix inconnu ».
        mockMvc.perform(patch("/api/ownerships/{id}/purchase-price", exemplaire.id())
                        .contentType("application/json").content("{\"purchasePrice\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchasePrice").doesNotExist());
    }

    @Test
    void rejects_a_non_numeric_purchase_price_with_400_and_never_500() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(patch("/api/ownerships/{id}/purchase-price", exemplaire.id())
                        .contentType("application/json").content("{\"purchasePrice\":\"beaucoup\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_absent_or_unparseable_body_with_400_and_never_500() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(patch("/api/ownerships/{id}/note", exemplaire.id())
                        .contentType("application/json").content(""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/ownerships/{id}/note", exemplaire.id())
                        .contentType("application/json").content("{pas du json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returns_404_when_patching_an_ownership_that_does_not_exist() throws Exception {
        mockMvc.perform(patch("/api/ownerships/{id}/note", ABSENT)
                        .contentType("application/json").content(json(Map.of("note", "x"))))
                .andExpect(status().isNotFound());
    }

    // ====================================================== DELETE

    @Test
    void deletes_an_ownership_without_touching_its_variant() throws Exception {
        Ownership exemplaire = unExemplaire();
        UUID variantId = exemplaire.variantId().orElseThrow();

        mockMvc.perform(delete("/api/ownerships/{id}", exemplaire.id()))
                .andExpect(status().isNoContent());

        assertThat(ownershipRepository.findById(exemplaire.id())).isEmpty();
        // Supprimer un exemplaire n'est pas supprimer le tome : le Variant
        // survit, sinon le catalogue se viderait à chaque revente.
        assertThat(variantId).isNotNull();
        mockMvc.perform(get("/api/entities/{id}", exemplaire.entityId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variants[0].id").value(variantId.toString()));
    }

    @Test
    void deleting_an_ownership_twice_stays_204_because_the_route_is_idempotent() throws Exception {
        Ownership exemplaire = unExemplaire();

        mockMvc.perform(delete("/api/ownerships/{id}", exemplaire.id())).andExpect(status().isNoContent());
        // Contrat existant : la seconde suppression ne redevient pas une erreur.
        // Verrouillé ici parce qu'un client qui rejoue une action hors ligne en
        // dépend, et qu'un 404 ultérieur serait un changement silencieux.
        mockMvc.perform(delete("/api/ownerships/{id}", exemplaire.id())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/ownerships/{id}", ABSENT)).andExpect(status().isNoContent());
    }

    // ============================================== Plusieurs exemplaires

    @Test
    void allows_several_ownerships_on_the_same_variant() throws Exception {
        // Un collectionneur peut posséder deux fois le même tome - un lu, un
        // neuf sous blister. Rien dans la couche HTTP ne doit supposer
        // « 1 Variant = 1 Ownership » : la liste doit en rendre deux, sur le
        // même variantId.
        String titre = "Vagabond " + UUID.randomUUID();
        QuickAddService.QuickAddResult premier = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), titre, OwnershipCondition.USED, Map.of(), 1, "Standard");
        QuickAddService.QuickAddResult second = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), titre, OwnershipCondition.NEW, Map.of(), 1, "Standard");

        // Même œuvre, même tome : le second exemplaire s'y rattache.
        assertThat(second.entityId()).isEqualTo(premier.entityId());
        assertThat(second.variantId()).isEqualTo(premier.variantId());

        mockMvc.perform(get("/api/ownerships").param("entityId", premier.entityId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].variantId").value(premier.variantId().toString()))
                .andExpect(jsonPath("$[1].variantId").value(premier.variantId().toString()));
    }
}
