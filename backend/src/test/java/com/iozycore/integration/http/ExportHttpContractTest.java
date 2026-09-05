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
 * Les deux routes d'export sont de simples GET sans mutation, et
 * {@code ExportCsvWriter} est déjà couvert par ses propres tests. Ce qui ne
 * l'était pas, et qui vit <b>uniquement dans le contrôleur</b> :
 *
 * <ul>
 *   <li>l'en-tête {@code Content-Disposition} qui donne son nom au fichier
 *       téléchargé - sans lui, le navigateur enregistre « csv » ou « json » ;</li>
 *   <li>l'assemblage du ZIP, écrit à la main dans la méthode plutôt que dans
 *       {@code ExportCsvWriter} - un ZIP mal formé ne se voit qu'à
 *       l'ouverture ;</li>
 *   <li>le {@code Content-Type} {@code application/zip}.</li>
 * </ul>
 *
 * C'est la raison d'être de cette classe : elle n'ajoute pas deux
 * « GET → 200 » décoratifs, elle ouvre réellement l'archive produite. L'export
 * est la garantie anti-enfermement du produit (docs/CONCEPTION.md §19) - un
 * export corrompu est un défaut grave et silencieux.
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
                .as("sans cet en-tête, le fichier téléchargé s'appelle « json »")
                .isNotNull()
                .contains("attachment")
                .contains("iozycore-export-" + LocalDate.now() + ".json");
    }

    @Test
    void the_json_export_contains_every_announced_section() throws Exception {
        // Le résumé de la route énumère ces sections : une clé disparue rendrait
        // l'export silencieusement incomplet, sans erreur ni status différent.
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

        // Le ZIP est assemblé à la main dans le contrôleur : le seul moyen de
        // prouver qu'il est valide est de l'ouvrir, pas de mesurer sa taille.
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
        assertThat(entities.lines().findFirst()).as("ligne d'en-tête").isPresent();
        // Les accents et caractères japonais doivent survivre au passage en
        // octets : le contrôleur encode explicitement en UTF-8, un défaut ici
        // ne casserait rien mais rendrait l'export illisible.
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
