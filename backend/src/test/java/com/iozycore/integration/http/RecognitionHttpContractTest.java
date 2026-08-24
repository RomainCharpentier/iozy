package com.iozycore.integration.http;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.recognition.RecognitionImageLimits;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
class RecognitionHttpContractTest extends HttpContractTestBase {

    private static final String ROUTE = "/api/recognition/analyze";

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    @Autowired
    private MangaEditionRepository editionRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    /** Une demande AVEC photos : c'est le seul chemin qui sollicite un moteur. */
    private Map<String, Object> corps(String declencheur, int photos) {
        List<String> urls = new ArrayList<>();
        for (int i = 0; i < photos; i++) {
            urls.add(FakeRecognitionProvider.photo(declencheur, i));
        }
        return Map.of("imageUrls", urls, "title", "Lot de test", "entityTypeCode", "MANGA");
    }

    /** Une demande SANS photos : texte seul, aucun moteur appelé. */
    private Map<String, Object> texteSeul(String titre) {
        return Map.of("title", titre, "entityTypeCode", "MANGA");
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
                .andExpect(jsonPath("$.visionStatus").value("OK"))
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
                .andExpect(jsonPath("$.visionStatus").value("PARTIAL"))
                .andExpect(jsonPath("$.unidentifiedCount").value(3));
    }

    @Test
    void nothing_recognized_is_a_200_not_an_error() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(corps(FakeRecognitionProvider.DECLENCHE_RIEN, 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("NOTHING_RECOGNIZED"))
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
                .andExpect(jsonPath("$.visionStatus").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void photos_from_a_host_no_provider_declares_yield_no_usable_image() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(Map.of("imageUrls", List.of("https://attaquant.invalid/1.jpg")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("NO_USABLE_IMAGE"))
                .andExpect(jsonPath("$.analyzedImageCount").value(0))
                .andExpect(jsonPath("$.requestedImageCount").value(1));
    }

    // ====================================================== Texte seul

    @Test
    void a_listing_title_alone_yields_proposals_without_any_photo() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(texteSeul("Platinum End intégrale tomes 1 à 14"))))
                .andExpect(status().isOk())
                // Aucune photo demandée : ce n'est pas un échec de lecture,
                // c'est l'absence de question.
                .andExpect(jsonPath("$.visionStatus").doesNotExist())
                .andExpect(jsonPath("$.items", hasSize(14)))
                .andExpect(jsonPath("$.textItemCount").value(14))
                .andExpect(jsonPath("$.requestedImageCount").value(0))
                .andExpect(jsonPath("$.analyzedImageCount").value(0));
    }

    @Test
    void a_text_only_request_never_calls_the_vision_engine() throws Exception {
        // Le test le plus important de cette passe : une annonce bien rédigée
        // est comprise sans le moindre appel payant.
        int avant = FakeRecognitionProvider.appelsAuMoteur();

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(texteSeul("Platinum End intégrale tomes 1 à 14"))))
                .andExpect(status().isOk());

        assertThat(FakeRecognitionProvider.appelsAuMoteur())
                .as("aucun moteur de vision sollicité pour analyser du texte")
                .isEqualTo(avant);
    }

    @Test
    void a_text_proposal_says_it_comes_from_the_listing_not_from_a_photo() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(texteSeul("Platinum End tomes 1 à 3"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].sources[0]").value("TEXT"))
                // Le libellé parle de la donnée, jamais du fournisseur d'IA.
                .andExpect(jsonPath("$.items[0].sourceLabels[0]").value("annonce"))
                .andExpect(jsonPath("$.items[0].sourceImages", hasSize(0)))
                .andExpect(jsonPath("$.items[0].editionHint").doesNotExist());
    }

    @Test
    void a_vague_listing_yields_no_proposal_rather_than_an_invented_series() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(texteSeul("Beau lot de mangas divers"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.textItemCount").value(0));
    }

    // ====================================================== Texte + photos

    @Test
    void text_and_photos_produce_a_single_merged_list() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        Map<String, Object> corps = Map.of(
                "title", "Platinum End tomes 1 à 3",
                "imageUrls", List.of(FakeRecognitionProvider.photo("normal", 0)),
                "entityTypeCode", "MANGA");

        // Le faux moteur voit les tomes 1 et 2 en Standard. Le texte en annonce
        // trois. Une seule liste en sort, pas deux.
        mockMvc.perform(post(ROUTE).contentType("application/json").content(json(corps)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("OK"))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.textItemCount").value(3));
    }

    @Test
    void a_volume_announced_but_not_photographed_is_never_dropped() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        Map<String, Object> corps = Map.of(
                "title", "Platinum End tomes 1 à 5",
                "imageUrls", List.of(FakeRecognitionProvider.photo("normal", 0)),
                "entityTypeCode", "MANGA");

        // Une photo qui ne montre pas un livre ne prouve pas son absence.
        mockMvc.perform(post(ROUTE).contentType("application/json").content(json(corps)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(5)));
    }

    @Test
    void a_broken_engine_leaves_the_text_proposals_standing() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        Map<String, Object> corps = Map.of(
                "title", "Platinum End tomes 1 à 4",
                "imageUrls", List.of(FakeRecognitionProvider.photo(FakeRecognitionProvider.DECLENCHE_PANNE, 0)),
                "entityTypeCode", "MANGA");

        mockMvc.perform(post(ROUTE).contentType("application/json").content(json(corps)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("UNAVAILABLE"))
                // Ce que le texte disait reste vrai même si le moteur tombe.
                .andExpect(jsonPath("$.items", hasSize(4)));
    }

    // ====================================================== Corps invalide

    @Test
    void a_request_with_neither_text_nor_photo_is_a_400() throws Exception {
        // Il n'y a littéralement rien à analyser.
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(Map.of("imageUrls", List.of()))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void an_entirely_empty_body_is_a_400() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void too_many_images_is_refused_explicitly_rather_than_silently_truncated() throws Exception {
        List<String> trop = new ArrayList<>();
        for (int i = 0; i <= RecognitionImageLimits.MAX_IMAGES; i++) {
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

    // ==================================================================
    //  Photos ENVOYÉES par l'utilisateur - /analyze-photos
    // ==================================================================
    //
    //  L'autre porte du moteur. Elle existe parce qu'une plateforme qui refuse
    //  la lecture automatique (Leboncoin), une annonce dont le texte ne nomme
    //  aucune série (« mangas en tout genre ») et une étagère photographiée
    //  chez soi ont un point commun : les photos existent, mais aucune URL
    //  n'est joignable. Ce que ces tests protègent, c'est qu'elle applique les
    //  MÊMES règles que l'autre - sans en hériter la surface réseau.

    private static final String ROUTE_PHOTOS = "/api/recognition/analyze-photos";

    /** Un JPEG réel dont les octets portent le mot-clé attendu par le faux moteur. */
    private static MockMultipartFile photoEnvoyee(String declencheur) {
        byte[] mot = declencheur.getBytes(StandardCharsets.ISO_8859_1);
        byte[] octets = new byte[Math.max(64, mot.length + 16)];
        octets[0] = (byte) 0xFF;
        octets[1] = (byte) 0xD8;
        octets[2] = (byte) 0xFF;
        octets[3] = (byte) 0xE0;
        System.arraycopy(mot, 0, octets, 16, mot.length);
        return new MockMultipartFile("photos", "lot.jpg", "image/jpeg", octets);
    }

    @Test
    void uploaded_photos_are_analyzed_and_answer_the_same_shape_as_the_url_route() throws Exception {
        mockMvc.perform(multipart(ROUTE_PHOTOS).file(photoEnvoyee("normal")).param("entityTypeCode", "MANGA"))
                .andExpect(status().isOk())
                // Même enveloppe exactement : l'écran ne doit pas avoir deux
                // lectures de réponse selon l'origine des photos.
                .andExpect(jsonPath("$.visionStatus").exists())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.requestedImageCount").value(1))
                .andExpect(jsonPath("$.analyzedImageCount").value(1));
    }

    @Test
    void uploaded_photos_work_with_NO_text_at_all() throws Exception {
        // Le cas « mangas en tout genre » : le titre n'apprend rien, les photos
        // sont la seule source. La route ne doit pas exiger de texte.
        mockMvc.perform(multipart(ROUTE_PHOTOS).file(photoEnvoyee("normal")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.textItemCount").value(0));
    }

    @Test
    void the_text_is_still_read_locally_alongside_uploaded_photos() throws Exception {
        mockMvc.perform(multipart(ROUTE_PHOTOS).file(photoEnvoyee("normal"))
                        .param("title", "Naruto tomes 1 à 3")
                        .param("entityTypeCode", "MANGA"))
                .andExpect(status().isOk())
                // Les deux sources sont consolidées ensemble, exactement comme
                // sur l'autre route - pas deux listes renvoyées côte à côte.
                .andExpect(jsonPath("$.textItemCount").value(3));
    }

    @Test
    void a_file_that_is_not_an_image_is_dropped_but_the_request_still_answers_200() throws Exception {
        MockMultipartFile faux = new MockMultipartFile("photos", "innocent.jpg", "image/jpeg",
                "#!/bin/sh".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart(ROUTE_PHOTOS).file(faux))
                .andExpect(status().isOk())
                // Envoyée mais pas analysée : l'écart est dit, pas masqué.
                .andExpect(jsonPath("$.requestedImageCount").value(1))
                .andExpect(jsonPath("$.analyzedImageCount").value(0))
                .andExpect(jsonPath("$.visionStatus").value("NO_USABLE_IMAGE"));
    }

    @Test
    void sending_no_photo_at_all_is_a_400() throws Exception {
        mockMvc.perform(multipart(ROUTE_PHOTOS).param("title", "Un lot"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void more_than_the_cap_is_refused_rather_than_silently_truncated() throws Exception {
        var requete = multipart(ROUTE_PHOTOS);
        for (int i = 0; i <= RecognitionImageLimits.MAX_IMAGES; i++) {
            requete = requete.file(photoEnvoyee("normal"));
        }

        mockMvc.perform(requete).andExpect(status().isBadRequest());
    }

    @Test
    void an_engine_failure_on_uploaded_photos_is_still_a_200() throws Exception {
        mockMvc.perform(multipart(ROUTE_PHOTOS).file(photoEnvoyee(FakeRecognitionProvider.DECLENCHE_PANNE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("UNAVAILABLE"));
    }

    @Test
    void nothing_readable_on_uploaded_photos_is_not_an_error_either() throws Exception {
        mockMvc.perform(multipart(ROUTE_PHOTOS).file(photoEnvoyee(FakeRecognitionProvider.DECLENCHE_RIEN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("NOTHING_RECOGNIZED"));
    }

    @Test
    void an_unknown_entity_type_does_not_crash_the_upload_route_either() throws Exception {
        mockMvc.perform(multipart(ROUTE_PHOTOS).file(photoEnvoyee("normal"))
                        .param("entityTypeCode", "UNIVERS_QUI_N_EXISTE_PAS"))
                .andExpect(status().isOk());
    }

    @Test
    void the_upload_route_writes_nothing() throws Exception {
        // On compte les séries de l'univers manga : c'est là qu'une fiche
        // serait créée si la route se mettait à « compléter » le catalogue.
        java.util.UUID typeManga = serieCataloguee("Une série témoin").entityTypeId();
        int possessionsAvant = ownershipRepository.findAll().size();
        int seriesAvant = entityRepository.findAllByType(typeManga).size();

        mockMvc.perform(multipart(ROUTE_PHOTOS).file(photoEnvoyee(FakeRecognitionProvider.DECLENCHE_HORS_CATALOGUE))
                        .param("title", "Naruto tomes 1 à 5")
                        .param("entityTypeCode", "MANGA"))
                .andExpect(status().isOk());

        // Proposer n'est pas posséder, et lire n'est pas cataloguer.
        assertThat(ownershipRepository.findAll()).hasSize(possessionsAvant);
        assertThat(entityRepository.findAllByType(typeManga)).hasSize(seriesAvant);
    }

    // ==================================================================
    //  « 9 tomes de Naruto » - l'annonce dit combien, pas lesquels
    // ==================================================================

    @Test
    void an_announced_count_is_reported_but_never_unrolled_into_volumes() throws Exception {
        serieCataloguee("Naruto");

        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(texteSeul("9 tomes de Naruto"))))
                .andExpect(status().isOk())
                // Aucune proposition : dérouler 1 à 9 fabriquerait un verdict
                // d'achat calculé sur des tomes que personne n'a vus.
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.textItemCount").value(0))
                // Mais ce que l'annonce dit vraiment est conservé.
                .andExpect(jsonPath("$.announcedVolumeCount").value(9))
                .andExpect(jsonPath("$.announcedSeriesTitle").value("Naruto"));
    }

    @Test
    void a_listing_that_names_its_volumes_carries_no_announced_count() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(texteSeul("Naruto tomes 1 à 9"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(9)))
                // Sinon l'écran dirait « 9 tomes annoncés » à côté de neuf
                // tomes déjà identifiés, comme si quelque chose manquait.
                .andExpect(jsonPath("$.announcedVolumeCount").doesNotExist());
    }

    @Test
    void a_count_without_an_identifiable_work_keeps_the_count_alone() throws Exception {
        mockMvc.perform(post(ROUTE).contentType("application/json")
                        .content(json(texteSeul("Lot de 9 mangas"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.announcedVolumeCount").value(9))
                .andExpect(jsonPath("$.announcedSeriesTitle").doesNotExist());
    }
}
