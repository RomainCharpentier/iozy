package com.iozycore.integration.http;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
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
 * The contract of the shelf import: read photos without writing anything, then
 * write what was confirmed, without ever creating a second copy.
 *
 * <p>The fake vision engine returns "Platinum End" volumes 1 and 2; the series
 * is always catalogued BEFORE the analysis, so that the import never goes
 * looking for a detail page in real sources during a test.
 */
@Import(FakeRecognitionProvider.class)
class ShelfImportHttpContractTest extends HttpContractTestBase {

    private static final String ROUTE_ANALYSE = "/api/shelf-import/analyze-photos";
    private static final String ROUTE_IMPORT = "/api/shelf-import/apply";

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    @Autowired
    private MangaEditionRepository editionRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    /** A real JPEG whose bytes carry the keyword expected by the fake engine. */
    private static MockMultipartFile photo(String declencheur) {
        byte[] mot = declencheur.getBytes(StandardCharsets.ISO_8859_1);
        byte[] octets = new byte[Math.max(64, mot.length + 16)];
        octets[0] = (byte) 0xFF;
        octets[1] = (byte) 0xD8;
        octets[2] = (byte) 0xFF;
        octets[3] = (byte) 0xE0;
        System.arraycopy(mot, 0, octets, 16, mot.length);
        return new MockMultipartFile("photos", "etagere.jpg", "image/jpeg", octets);
    }

    private EntityType typeManga() {
        return entityTypeRepository.findByCode("MANGA")
                .orElseGet(() -> entityTypeRepository.save(
                        EntityType.create("MANGA", "Manga", Set.of("READ"), Set.of())));
    }

    private Entity serieCataloguee(String titre) {
        EntityType manga = typeManga();
        return entityRepository.findByTypeAndTitle(manga.id(), titre)
                .orElseGet(() -> entityRepository.save(Entity.create(manga.id(), titre)));
    }

    private void editionCataloguee(UUID entityId, String serie, String edition, Integer tomes) {
        java.time.Instant maintenant = java.time.Instant.now();
        editionRepository.save(new MangaEdition(UUID.randomUUID(), entityId, serie, edition,
                EditionTier.STANDARD, null, tomes, null, false, false, null, null, maintenant, maintenant));
    }

    private static Map<String, Object> tome(String serie, int numero, String edition) {
        return edition == null
                ? Map.of("seriesTitle", serie, "volumeNumber", numero)
                : Map.of("seriesTitle", serie, "volumeNumber", numero, "edition", edition);
    }

    private static Map<String, Object> demande(List<Map<String, Object>> tomes) {
        return Map.of("items", tomes);
    }

    private long possessionsActives(UUID entityId) {
        return ownershipRepository.findByEntityId(entityId).stream().filter(Ownership::isActive).count();
    }

    // ====================================================== Read

    @Test
    void reading_the_shelf_returns_the_volumes_matched_to_the_catalog_and_writes_nothing() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(multipart(ROUTE_ANALYSE).file(photo("normal")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("OK"))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].item.seriesTitle").value("Platinum End"))
                .andExpect(jsonPath("$.items[0].item.volumeNumber").value(1))
                .andExpect(jsonPath("$.items[0].item.catalogStatus").value("MATCHED"))
                .andExpect(jsonPath("$.items[0].item.entityId").value(serie.id().toString()))
                .andExpect(jsonPath("$.items[0].alreadyOwned").value(false))
                .andExpect(jsonPath("$.items[0].proposal").doesNotExist())
                // Where the book was seen: enough to draw a frame on the photo.
                .andExpect(jsonPath("$.items[0].item.boxes[0].image").value(0))
                .andExpect(jsonPath("$.items[0].item.boxes[0].top").value(0.1))
                .andExpect(jsonPath("$.items[0].item.boxes[0].right").value(0.3))
                .andExpect(jsonPath("$.notInCatalogCount").value(0))
                .andExpect(jsonPath("$.analyzedImageCount").value(1))
                .andExpect(jsonPath("$.requestedImageCount").value(1))
                .andExpect(jsonPath("$.lookupsSkipped").value(0));

        assertThat(possessionsActives(serie.id())).isZero();
    }

    @Test
    void reading_without_a_photo_or_with_too_many_is_refused() throws Exception {
        mockMvc.perform(multipart(ROUTE_ANALYSE)
                        .file(new MockMultipartFile("photos", "vide.jpg", "image/jpeg", new byte[0])))
                .andExpect(status().isBadRequest());

        var requete = multipart(ROUTE_ANALYSE);
        for (int i = 0; i < 9; i++) {
            requete.file(photo("normal"));
        }
        mockMvc.perform(requete).andExpect(status().isBadRequest());
    }

    // ====================================================== Write

    @Test
    void importing_confirmed_volumes_adds_them_once_and_flags_them_owned_next_time() throws Exception {
        Entity serie = serieCataloguee("Platinum End");
        editionCataloguee(serie.id(), "Platinum End", "Standard", 14);

        mockMvc.perform(post(ROUTE_IMPORT).contentType("application/json").content(json(demande(List.of(
                        tome("Platinum End", 1, "Standard"), tome("Platinum End", 2, "Standard"))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(2))
                .andExpect(jsonPath("$.alreadyOwned").value(0))
                .andExpect(jsonPath("$.seriesCreated").value(0))
                .andExpect(jsonPath("$.items[0].outcome").value("ADDED"))
                .andExpect(jsonPath("$.items[0].entityId").value(serie.id().toString()));

        assertThat(possessionsActives(serie.id())).isEqualTo(2);

        // The same import a second time: nothing more is written.
        mockMvc.perform(post(ROUTE_IMPORT).contentType("application/json").content(json(demande(List.of(
                        tome("Platinum End", 1, "Standard"), tome("Platinum End", 2, "Standard"))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(0))
                .andExpect(jsonPath("$.alreadyOwned").value(2))
                .andExpect(jsonPath("$.items[1].outcome").value("ALREADY_OWNED"));

        assertThat(possessionsActives(serie.id())).isEqualTo(2);

        // And the shelf read again says that these volumes are owned.
        mockMvc.perform(multipart(ROUTE_ANALYSE).file(photo("normal")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].alreadyOwned").value(true))
                .andExpect(jsonPath("$.items[1].alreadyOwned").value(true));
    }

    @Test
    void importing_an_unknown_series_creates_it_with_the_sheet_kept_by_the_user() throws Exception {
        typeManga();
        String titre = "Série photographiée " + UUID.randomUUID();

        mockMvc.perform(post(ROUTE_IMPORT).contentType("application/json").content(json(demande(List.of(
                        Map.of("seriesTitle", titre, "volumeNumber", 1,
                                "attributes", Map.of("mangaka", "Autrice de test"),
                                "coverImageUrl", "https://source-de-test.invalid/couverture.jpg"))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(1))
                .andExpect(jsonPath("$.seriesCreated").value(1))
                .andExpect(jsonPath("$.items[0].seriesCreated").value(true));

        Entity creee = entityRepository.findByTypeAndTitle(typeManga().id(), titre).orElseThrow();
        assertThat(creee.attributes())
                .containsEntry("mangaka", "Autrice de test")
                .containsEntry("coverImageUrl", "https://source-de-test.invalid/couverture.jpg");
        assertThat(creee.variants()).hasSize(1);
        assertThat(creee.variants().get(0).label()).isEqualTo("Tome 1");
        assertThat(possessionsActives(creee.id())).isEqualTo(1);
    }

    @Test
    void a_volume_without_title_or_number_is_refused_and_nothing_is_written() throws Exception {
        Entity serie = serieCataloguee("Platinum End");

        mockMvc.perform(post(ROUTE_IMPORT).contentType("application/json").content(json(demande(List.of(
                        tome("Platinum End", 1, "Standard"), tome("Platinum End", 0, "Standard"))))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(ROUTE_IMPORT).contentType("application/json").content(json(demande(List.of(
                        Map.of("seriesTitle", "  ", "volumeNumber", 1))))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(ROUTE_IMPORT).contentType("application/json").content(json(demande(List.of()))))
                .andExpect(status().isBadRequest());

        assertThat(possessionsActives(serie.id())).isZero();
    }

    @Test
    void a_spent_quota_is_named_as_such_rather_than_as_something_to_retry() throws Exception {
        typeManga();

        mockMvc.perform(multipart(ROUTE_ANALYSE).file(photo(FakeRecognitionProvider.DECLENCHE_QUOTA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visionStatus").value("QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.analyzedImageCount").value(1));
    }
}
