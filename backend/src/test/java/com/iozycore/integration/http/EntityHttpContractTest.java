package com.iozycore.integration.http;

import com.iozycore.application.CatalogEntityResolver;
import com.iozycore.application.QuickAddService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.HashMap;
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
 * Le contrat HTTP de {@code /api/entities} - onze routes, aucune couverte au
 * niveau de la requête jusqu'ici.
 *
 * <h2>Le risque propre à ce contrôleur</h2>
 * Il porte les mutations du <b>catalogue</b>, et son mapping d'erreurs n'est pas
 * uniforme : trois routes attrapent elles-mêmes {@code IllegalArgumentException}
 * pour la traduire (en 400 pour un renommage vide, en 404 pour un Variant
 * introuvable), tandis que les autres laissent {@code ApiExceptionHandler}
 * décider. Ces choix sont délibérés et forment le contrat ; ces tests les
 * figent, pour qu'un déplacement de {@code try/catch} ne change pas
 * silencieusement un 404 en 400.
 *
 * <h2>L'invariant produit qui compte le plus ici</h2>
 * <b>Catalogue ≠ Collection.</b> Une œuvre peut exister sans aucune possession -
 * une envie, un scan, une série repérée. Deux tests le protègent explicitement :
 * la fiche se lit, et rien ne fabrique de possession au passage.
 */
class EntityHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    private static final String MANGA = "00000000-0000-0000-0000-000000000001";

    private Entity uneSerieAvecPossession() {
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Naruto " + UUID.randomUUID(), OwnershipCondition.USED,
                Map.of(), 1, "Standard");
        return entityRepository.findById(result.entityId()).orElseThrow();
    }

    // ====================================================== POST /quick-add

    @Test
    void creates_a_series_a_volume_and_an_ownership_in_one_request() throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("entityTypeId", MANGA);
        corps.put("title", "One Piece " + UUID.randomUUID());
        corps.put("condition", "USED");
        corps.put("volumeNumber", 3);
        corps.put("edition", "Standard");

        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json").content(json(corps)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entityId").isNotEmpty())
                .andExpect(jsonPath("$.variantId").isNotEmpty())
                // Le contrat porte aussi ces deux drapeaux : le client s'en sert
                // pour dire « ajouté » ou « déjà dans ta collection ».
                .andExpect(jsonPath("$.matchedExistingEntity").value(false))
                .andExpect(jsonPath("$.matchedExistingVariant").value(false));
    }

    @Test
    void reports_a_second_add_of_the_same_volume_as_matching_an_existing_entity() throws Exception {
        String titre = "Bleach " + UUID.randomUUID();
        Map<String, Object> corps = new HashMap<>();
        corps.put("entityTypeId", MANGA);
        corps.put("title", titre);
        corps.put("condition", "USED");
        corps.put("volumeNumber", 1);
        corps.put("edition", "Standard");
        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json").content(json(corps)))
                .andExpect(status().isCreated());

        // La déduplication est une règle métier testée ailleurs ; ce qui se joue
        // ici, c'est qu'elle remonte bien jusqu'au JSON.
        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json").content(json(corps)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.matchedExistingEntity").value(true))
                .andExpect(jsonPath("$.matchedExistingVariant").value(true));
    }

    @Test
    void rejects_quick_add_without_entity_type_with_400_and_never_500() throws Exception {
        // Le cas historique : entityTypeId absent descendait jusqu'à Spring Data,
        // qui refuse findById(null), et le client recevait un 500 avec la trace.
        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json")
                        .content("{\"title\":\"x\",\"condition\":\"USED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void rejects_quick_add_with_an_unknown_entity_type_with_400() throws Exception {
        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json")
                        .content("{\"entityTypeId\":\"" + ABSENT + "\",\"title\":\"x\",\"condition\":\"USED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_quick_add_with_an_invalid_condition_enum_with_400_and_never_500() throws Exception {
        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json")
                        .content("{\"entityTypeId\":\"" + MANGA + "\",\"title\":\"x\",\"condition\":\"PAS_UN_ETAT\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_empty_or_unparseable_quick_add_body_with_400_and_never_500() throws Exception {
        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json").content(""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/entities/quick-add").contentType("application/json").content("{pas du json"))
                .andExpect(status().isBadRequest());
    }

    // ============================================== Catalogue != Collection

    @Test
    void reads_a_catalog_entity_that_has_no_ownership_at_all() throws Exception {
        // Une œuvre entrée par les envies ou un scan : elle existe, sans qu'on
        // la possède. Sa fiche doit se lire normalement - un 404 ou une erreur
        // ici casserait tout le parcours Envies.
        Entity sansPossession = catalogEntityResolver.resolveOrCreate(
                EntityTypeFixtures.MANGA.id(), "Monster " + UUID.randomUUID(), Map.of()).entity();

        mockMvc.perform(get("/api/entities/{id}", sansPossession.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(sansPossession.id().toString()))
                .andExpect(jsonPath("$.title").isNotEmpty());

        // L'assertion qui compte vraiment : rien n'a fabriqué de possession au
        // passage. Sans elle, le test passerait aussi avec une Ownership fictive.
        assertThat(ownershipRepository.findByEntityId(sansPossession.id())).isEmpty();
    }

    @Test
    void listing_by_type_returns_catalog_entities_without_requiring_ownership() throws Exception {
        Entity sansPossession = catalogEntityResolver.resolveOrCreate(
                EntityTypeFixtures.MANGA.id(), "Pluto " + UUID.randomUUID(), Map.of()).entity();

        mockMvc.perform(get("/api/entities").param("entityTypeId", MANGA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + sansPossession.id() + "')]").exists());
    }

    // ===================================================== Lectures et erreurs

    @Test
    void returns_404_when_the_entity_does_not_exist() throws Exception {
        mockMvc.perform(get("/api/entities/{id}", ABSENT)).andExpect(status().isNotFound());
    }

    @Test
    void rejects_a_malformed_entity_id_with_400_and_never_500() throws Exception {
        // Un seul cas suffit à protéger la conversion de path param : elle est
        // globale à Spring, la multiplier sur onze routes n'apprendrait rien.
        mockMvc.perform(get("/api/entities/{id}", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void rejects_listing_without_the_required_entity_type_parameter_with_400() throws Exception {
        mockMvc.perform(get("/api/entities")).andExpect(status().isBadRequest());
    }

    @Test
    void search_accepts_no_parameter_and_returns_an_empty_list_when_nothing_matches() throws Exception {
        mockMvc.perform(get("/api/entities/search")).andExpect(status().isOk());

        // Aucun résultat n'est pas une erreur : l'écran de recherche affiche
        // « rien trouvé », il ne gère pas un 404.
        mockMvc.perform(get("/api/entities/search").param("q", "zzz-aucune-oeuvre-" + UUID.randomUUID()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void search_finds_an_entity_by_its_title() throws Exception {
        Entity serie = uneSerieAvecPossession();

        mockMvc.perform(get("/api/entities/search").param("q", serie.title()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + serie.id() + "')]").exists());
    }

    @Test
    void rejects_a_malformed_type_filter_in_search_with_400() throws Exception {
        mockMvc.perform(get("/api/entities/search").param("entityTypeId", MALFORME))
                .andExpect(status().isBadRequest());
    }

    // ======================================================= PATCH attributs

    @Test
    void merges_series_attributes_without_erasing_existing_ones() throws Exception {
        Entity serie = uneSerieAvecPossession();
        mockMvc.perform(patch("/api/entities/{id}", serie.id()).contentType("application/json")
                        .content(json(Map.of("mangaka", "Kishimoto")))).andExpect(status().isOk());

        mockMvc.perform(patch("/api/entities/{id}", serie.id()).contentType("application/json")
                        .content(json(Map.of("publisher", "Kana"))))
                .andExpect(status().isOk())
                // « Compléter/corriger », pas « remplacer » : le premier attribut
                // survit au second appel.
                .andExpect(jsonPath("$.attributes.mangaka").value("Kishimoto"))
                .andExpect(jsonPath("$.attributes.publisher").value("Kana"));
    }

    @Test
    void removes_a_single_attribute_and_stays_204_when_the_key_was_absent() throws Exception {
        Entity serie = uneSerieAvecPossession();
        mockMvc.perform(patch("/api/entities/{id}", serie.id()).contentType("application/json")
                .content(json(Map.of("cover", "https://exemple.test/x.jpg")))).andExpect(status().isOk());

        mockMvc.perform(delete("/api/entities/{id}/attributes/{key}", serie.id(), "cover"))
                .andExpect(status().isNoContent());
        // Contrat documenté : 204 même si la clé n'existait pas.
        mockMvc.perform(delete("/api/entities/{id}/attributes/{key}", serie.id(), "cover"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/entities/{id}", serie.id()))
                .andExpect(jsonPath("$.attributes.cover").doesNotExist());
    }

    @Test
    void rejects_a_non_object_attribute_body_with_400_and_never_500() throws Exception {
        Entity serie = uneSerieAvecPossession();
        for (String corps : new String[] {"null", "[1,2]", "\"texte\"", "{pas du json"}) {
            mockMvc.perform(patch("/api/entities/{id}", serie.id())
                            .contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void returns_404_when_patching_attributes_of_an_absent_entity() throws Exception {
        mockMvc.perform(patch("/api/entities/{id}", ABSENT).contentType("application/json")
                        .content(json(Map.of("a", "b")))).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/entities/{id}/attributes/{key}", ABSENT, "cover"))
                .andExpect(status().isNotFound());
    }

    // ========================================================= PATCH rename

    @Test
    void renames_a_series_without_touching_its_volumes() throws Exception {
        Entity serie = uneSerieAvecPossession();
        String nouveauTitre = "Naruto Shippuden " + UUID.randomUUID();

        mockMvc.perform(patch("/api/entities/{id}/rename", serie.id()).contentType("application/json")
                        .content(json(Map.of("title", nouveauTitre))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value(nouveauTitre))
                // Le lien Série -> Tome passe par des identifiants, pas par le
                // titre : un renommage ne doit rien détacher.
                .andExpect(jsonPath("$.variants.length()").value(serie.variants().size()));
    }

    @Test
    void rejects_an_empty_or_missing_title_on_rename_with_400() throws Exception {
        Entity serie = uneSerieAvecPossession();

        // Deux corps différents, une seule règle : un titre vide est refusé.
        // 400 et non 409 - c'est une saisie invalide, pas un conflit d'état.
        mockMvc.perform(patch("/api/entities/{id}/rename", serie.id())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/entities/{id}/rename", serie.id())
                        .contentType("application/json").content(json(Map.of("title", "   "))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returns_404_when_renaming_an_absent_entity() throws Exception {
        mockMvc.perform(patch("/api/entities/{id}/rename", ABSENT).contentType("application/json")
                        .content(json(Map.of("title", "x")))).andExpect(status().isNotFound());
    }

    // ======================================================= Variants

    @Test
    void returns_404_when_the_variant_does_not_belong_to_the_entity() throws Exception {
        Entity serie = uneSerieAvecPossession();

        // Le contrôleur traduit ici IllegalArgumentException en 404 - un Variant
        // inconnu est une ressource absente, pas une requête invalide. Choix
        // délibéré, figé par ce test : les autres routes de ce contrôleur
        // rendent 400 sur la même exception.
        mockMvc.perform(patch("/api/entities/{e}/variants/{v}", serie.id(), ABSENT)
                        .contentType("application/json").content(json(Map.of("cover", "x"))))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/entities/{e}/variants/{v}", serie.id(), ABSENT))
                .andExpect(status().isNotFound());
    }

    @Test
    void refuses_to_delete_a_volume_still_referenced_by_an_ownership_with_409() throws Exception {
        Entity serie = uneSerieAvecPossession();
        UUID variantId = serie.variants().get(0).id();

        // Supprimer un tome possédé effacerait la possession sans le dire :
        // VariantDeletionNotAllowedException -> 409.
        mockMvc.perform(delete("/api/entities/{e}/variants/{v}", serie.id(), variantId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    // ======================================================= DELETE entity

    @Test
    void refuses_to_delete_a_series_that_still_has_ownerships_with_409() throws Exception {
        Entity serie = uneSerieAvecPossession();

        mockMvc.perform(delete("/api/entities/{id}", serie.id()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void deletes_a_catalog_entity_that_has_no_ownership() throws Exception {
        Entity sansPossession = catalogEntityResolver.resolveOrCreate(
                EntityTypeFixtures.MANGA.id(), "Dorohedoro " + UUID.randomUUID(), Map.of()).entity();

        mockMvc.perform(delete("/api/entities/{id}", sansPossession.id()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/entities/{id}", sansPossession.id()))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleting_an_absent_entity_stays_204_because_the_route_is_idempotent() throws Exception {
        mockMvc.perform(delete("/api/entities/{id}", ABSENT)).andExpect(status().isNoContent());
    }
}
