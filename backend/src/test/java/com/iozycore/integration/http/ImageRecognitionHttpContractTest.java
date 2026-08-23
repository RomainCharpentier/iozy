package com.iozycore.integration.http;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.recognition.RecognitionImageFetcher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le contrat HTTP du seul endpoint créé par ce chantier.
 *
 * <p>La campagne C2 est close ; celle-ci ne la rouvre pas. Un endpoint neuf
 * naît simplement avec son contrat, plutôt que d'attendre une campagne pour
 * l'obtenir.
 *
 * <p>Aucun appel réseau, aucun appel IA : voir {@link FakeRecognitionProvider}.
 */
@Import(FakeRecognitionProvider.class)
class ImageRecognitionHttpContractTest extends HttpContractTestBase {

    private static final String ROUTE = "/api/image-recognition/analyze";

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    @Autowired
    private MangaEditionRepository editionRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    private Map<String, Object> corps(String declencheur, int photos) {
        List<String> urls = new ArrayList<>();
        for (int i = 0; i < photos; i++) {
            urls.add(FakeRecognitionProvider.photo(declencheur, i));
        }
        return Map.of("imageUrls", urls, "listingTitle", "Lot de test", "entityTypeCode", "MANGA");
    }

    private Entity serieCataloguee(String titre) {
        EntityType manga = entityTypeRepository.findByCode("MANGA")
                .orElseGet(() -> entityTypeRepository.save(
                        EntityType.create("MANGA", "Manga", Set.of("READ"), Set.of())));
        return entityRepository.findByTypeAndTitle(manga.id(), titre)
                .orElseGet(() -> entityRepository.save(Entity.create(manga.id(), titre)));
    }

    private void editionCataloguee(UUID entityId, String serie, String edition, Integer tomes) {
        java.time.Instant maintenant = java.time.Instant.now();
        editionRepository.save(new MangaEdition(UUID.randomUUID(), entityId, serie, edition,
                EditionTier.STANDARD, null, tomes, null, false, false, null, null, maintenant, maintenant));
    }

    // ====================================================== Succès

    @Test
    void recognized_volumes_come_back_matched_to_the_catalog() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE).contentType("application/json").content(json(corps("normal", 2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].seriesTitle").value("Platinum End"))
                .andExpect(jsonPath("$.items[0].catalogStatus").value("MATCHED"))
                .andExpect(jsonPath("$.items[0].entityId").value(serie.id().toString()))
                .andExpect(jsonPath("$.analyzedImageCount").value(2))
                .andExpect(jsonPath("$.requestedImageCount").value(2));
    }

    @Test
    void the_response_carries_the_evidence_and_the_photos_behind_each_item() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE).contentType("application/json").content(json(corps("normal", 1))))
                .andExpect(status().isOk())
                // L'utilisateur doit pouvoir comprendre POURQUOI on lui propose ça.
                .andExpect(jsonPath("$.items[0].evidence[0]").value("lecture de test"))
                .andExpect(jsonPath("$.items[0].sourceImages[0]").value(0))
                .andExpect(jsonPath("$.items[0].confidence").value("HIGH"));
    }

    @Test
    void only_a_high_confidence_catalog_match_is_preselected() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE).contentType("application/json").content(json(corps("normal", 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].confidence").value("HIGH"))
                .andExpect(jsonPath("$.items[0].preselected").value(true))
                .andExpect(jsonPath("$.items[1].confidence").value("MEDIUM"))
                .andExpect(jsonPath("$.items[1].preselected").value(false));
    }

    // ====================================================== Doublons

    @Test
    void one_volume_seen_on_three_photos_is_one_item_in_the_response() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(corps(FakeRecognitionProvider.DECLENCHE_DOUBLON, 3))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].sourceImages", hasSize(3)));
    }

    // ====================================================== Résultat partiel

    @Test
    void unidentified_items_are_reported_rather_than_hidden() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(corps(FakeRecognitionProvider.DECLENCHE_PARTIEL, 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PARTIAL"))
                .andExpect(jsonPath("$.unidentifiedCount").value(3));
    }

    @Test
    void nothing_recognized_is_a_200_not_an_error() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(corps(FakeRecognitionProvider.DECLENCHE_RIEN, 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOTHING_RECOGNIZED"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    // ====================================================== Catalogue

    @Test
    void something_recognized_but_absent_from_the_catalog_is_flagged_never_created() throws Exception {
        EntityType manga = entityTypeRepository.findByCode("MANGA")
                .orElseGet(() -> entityTypeRepository.save(
                        EntityType.create("MANGA", "Manga", Set.of("READ"), Set.of())));
        int avant = entityRepository.findAllByType(manga.id()).size();

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(corps(FakeRecognitionProvider.DECLENCHE_HORS_CATALOGUE, 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].catalogStatus").value("NOT_IN_CATALOG"))
                .andExpect(jsonPath("$.items[0].entityId").doesNotExist())
                .andExpect(jsonPath("$.notInCatalogCount").value(1));

        assertThat(entityRepository.findAllByType(manga.id()))
                .as("aucune fiche catalogue créée par une reconnaissance").hasSize(avant);
    }

    @Test
    void an_unknown_edition_is_offered_for_confirmation_never_chosen() throws Exception {
        Entity serie = serieCataloguee("Death Note");
        editionCataloguee(serie.id(), "Death Note", "Standard", 12);
        editionCataloguee(serie.id(), "Death Note", "Black Edition", 6);

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(corps(FakeRecognitionProvider.DECLENCHE_EDITION_INCONNUE, 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].catalogStatus").value("EDITION_TO_CONFIRM"))
                .andExpect(jsonPath("$.items[0].editionHint").doesNotExist())
                .andExpect(jsonPath("$.items[0].editionOptions", hasSize(2)))
                .andExpect(jsonPath("$.items[0].preselected").value(false))
                .andExpect(jsonPath("$.items[0].readyForAnalysis").value(false));
    }

    // ====================================================== Aucune écriture

    @Test
    void analyzing_photos_never_creates_an_ownership() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);
        int avant = ownershipRepository.findAll().size();

        mockMvc.perform(post(ROUTE).contentType("application/json").content(json(corps("normal", 2))))
                .andExpect(status().isOk());

        // Reconnaître ce que contient une annonce n'est pas l'avoir achetée.
        assertThat(ownershipRepository.findAll()).hasSize(avant);
    }

    // ====================================================== Panne moteur

    @Test
    void an_unavailable_engine_is_a_200_with_a_status_the_screen_can_explain() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(corps(FakeRecognitionProvider.DECLENCHE_PANNE, 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void photos_from_a_host_no_provider_declares_yield_no_usable_image() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(Map.of("imageUrls", List.of("https://attaquant.invalid/1.jpg")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NO_USABLE_IMAGE"))
                .andExpect(jsonPath("$.analyzedImageCount").value(0))
                .andExpect(jsonPath("$.requestedImageCount").value(1));
    }

    // ====================================================== Corps invalide

    @Test
    void no_image_at_all_is_a_400() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(Map.of("imageUrls", List.of()))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void a_body_without_the_images_field_is_a_400() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void too_many_images_is_refused_explicitly_rather_than_silently_truncated() throws Exception {
        List<String> trop = new ArrayList<>();
        for (int i = 0; i <= RecognitionImageFetcher.MAX_IMAGES; i++) {
            trop.add(FakeRecognitionProvider.photo("normal", i));
        }

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(Map.of("imageUrls", trop))))
                // Status seul : MockMvc ne rejoue pas la redirection d'erreur du
                // conteneur, donc le corps d'un ResponseStatusException y est vide
                // alors qu'il est bien rempli en HTTP réel.
                .andExpect(status().isBadRequest());
    }

    @Test
    void a_broken_json_body_is_a_400() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json").content("{ceci n'est pas du json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void an_empty_body_is_a_400() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json").content(""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void an_unknown_entity_type_code_does_not_crash_the_route() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(Map.of("imageUrls", List.of(FakeRecognitionProvider.photo("normal", 0)),
                                "entityTypeCode", "UNIVERS_QUI_N_EXISTE_PAS"))))
                .andExpect(status().isOk());
    }
}
