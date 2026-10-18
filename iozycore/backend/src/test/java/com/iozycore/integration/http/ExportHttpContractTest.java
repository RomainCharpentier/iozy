package com.iozycore.integration.http;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The two export routes are simple GETs without mutation, and
 * {@code ExportCsvWriter} is already covered by its own tests. What was not
 * covered, and lives <b>only in the controller</b>:
 *
 * <ul>
 *   <li>the {@code Content-Disposition} header that gives its name to the downloaded
 *       file - without it, the browser saves "csv" or "json";</li>
 *   <li>the assembly of the ZIP, written by hand in the method rather than in
 *       {@code ExportCsvWriter} - a badly formed ZIP is only seen
 *       when opened;</li>
 *   <li>the {@code Content-Type} {@code application/zip}.</li>
 * </ul>
 *
 * This is the reason for this class: it does not add two decorative
 * "GET -> 200", it really opens the archive produced. The export
 * is the anti-lock-in guarantee of the product (docs/CONCEPTION.md §19) - a
 * corrupted export is a serious and silent defect.
 */
class ExportHttpContractTest extends HttpContractTestBase {

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    // ====================================================== JSON

    @Test
    void the_json_export_carries_a_dated_attachment_file_name() throws Exception {
        MvcResult resultat = mockMvc.perform(get("/api/export/json"))
                .andExpect(status().isOk())
                .andReturn();

        String disposition = resultat.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION);
        assertThat(disposition)
                .as("without this header, the downloaded file is called \"json\"")
                .isNotNull()
                .contains("attachment")
                .contains("iozycore-export-" + LocalDate.now() + ".json");
    }

    @Test
    void the_json_export_contains_every_announced_section() throws Exception {
        // The summary of the route lists these sections: a missing key would make
        // the export silently incomplete, with no error or different status.
        mockMvc.perform(get("/api/export/json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entities").exists())
                .andExpect(jsonPath("$.ownerships").exists())
                .andExpect(jsonPath("$.experiences").exists())
                .andExpect(jsonPath("$.wishlist").exists())
                .andExpect(jsonPath("$.relationships").exists())
                .andExpect(jsonPath("$.tags").exists());
    }

    @Test
    void the_json_export_actually_carries_the_collection() throws Exception {
        Entity oeuvre = uneOeuvre("Oeuvre exportee " + UUID.randomUUID());

        mockMvc.perform(get("/api/export/json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entities[?(@.title == '%s')]".formatted(oeuvre.title())).exists());
    }

    // ====================================================== CSV / ZIP

    @Test
    void the_csv_export_is_a_zip_attachment() throws Exception {
        MvcResult resultat = mockMvc.perform(get("/api/export/csv"))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(resultat.getResponse().getContentType()).isEqualTo(MediaType.valueOf("application/zip").toString());
        assertThat(resultat.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION))
                .isNotNull()
                .contains("attachment")
                .contains("iozycore-export-" + LocalDate.now() + ".zip");
    }

    @Test
    void the_csv_archive_really_opens_and_holds_one_file_per_resource() throws Exception {
        byte[] archive = mockMvc.perform(get("/api/export/csv"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        // The ZIP is assembled by hand in the controller: the only way to
        // prove it is valid is to open it, not to measure its size.
        List<String> fichiers = new ArrayList<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archive))) {
            ZipEntry entree;
            while ((entree = zip.getNextEntry()) != null) {
                fichiers.add(entree.getName());
                zip.closeEntry();
            }
        }

        assertThat(fichiers).contains("entities.csv", "variants.csv", "ownerships.csv",
                "experiences.csv", "wishlist.csv", "relationships.csv", "tags.csv");
    }

    @Test
    void the_exported_csv_is_readable_utf8_with_its_header_row() throws Exception {
        Entity oeuvre = uneOeuvre("Été à Ōsaka " + UUID.randomUUID());

        byte[] archive = mockMvc.perform(get("/api/export/csv"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();

        String entities = lireDansArchive(archive, "entities.csv");

        assertThat(entities).isNotBlank();
        assertThat(entities.lines().findFirst()).as("header line").isPresent();
        // The accents and Japanese characters must survive the conversion into
        // bytes: the controller encodes explicitly in UTF-8, a defect here
        // would break nothing but would make the export unreadable.
        assertThat(entities).contains(oeuvre.title());
    }

    // ====================================================== Utilitaires

    private Entity uneOeuvre(String titre) {
        EntityType type = entityTypeRepository.findByCode("MANGA")
                .orElseGet(() -> entityTypeRepository.save(
                        EntityType.create("MANGA", "Manga", Set.of("READ"), Set.of())));
        return entityRepository.save(Entity.create(type.id(), titre));
    }

    private String lireDansArchive(byte[] archive, String nom) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archive))) {
            ZipEntry entree;
            while ((entree = zip.getNextEntry()) != null) {
                if (entree.getName().equals(nom)) {
                    return new String(zip.readAllBytes(), StandardCharsets.UTF_8);
                }
                zip.closeEntry();
            }
        }
        throw new AssertionError("Fichier absent de l'archive : " + nom);
    }
}
