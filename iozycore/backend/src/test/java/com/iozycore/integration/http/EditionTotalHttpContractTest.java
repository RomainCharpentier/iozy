package com.iozycore.integration.http;

import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.domain.TotalSource;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code PUT /api/manga/series/{entityId}/total} and the provenance columns of
 * V40: a total set by hand, cleared back to unknown, and shown with its source
 * where the progress already shows the total.
 */
class EditionTotalHttpContractTest extends HttpContractTestBase {

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @PersistenceContext
    private EntityManager entityManager;

    private Entity serieAvecTomes(String edition) {
        Entity serie = catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                "Pluto " + UUID.randomUUID(), Map.of()).entity();
        serie.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", edition));
        serie.addVariant("Tome 2", Map.of("volumeNumber", 2, "edition", edition));
        return entityRepository.save(serie);
    }

    private String url(Entity serie) {
        return "/api/manga/series/" + serie.id() + "/total";
    }

    @Test
    void sets_a_manual_total_on_the_single_edition_creating_it_and_shows_it_in_the_progress() throws Exception {
        Entity serie = serieAvecTomes("Kana");

        mockMvc.perform(put(url(serie)).contentType("application/json").content("{\"totalVolumes\":8}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editionId").isNotEmpty())
                .andExpect(jsonPath("$.entityId").value(serie.id().toString()))
                .andExpect(jsonPath("$.editionName").value("Kana"))
                .andExpect(jsonPath("$.totalVolumes").value(8))
                .andExpect(jsonPath("$.totalSource").value("MANUAL"))
                .andExpect(jsonPath("$.frenchRunFinished").value(false));

        mockMvc.perform(get("/api/insights/progress/" + serie.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editions[0].totalVolumes").value(8))
                .andExpect(jsonPath("$.editions[0].totalSource").value("MANUAL"))
                .andExpect(jsonPath("$.editions[0].frenchRunFinished").value(false));
    }

    @Test
    void clears_a_provider_total_back_to_unknown_so_the_job_tries_again() throws Exception {
        Entity serie = serieAvecTomes("Kana");
        MangaEdition provider = mangaEditionRepository.save(MangaEdition.create(serie.id(), serie.title(), "Kana",
                EditionTier.STANDARD, null, null, null, false, false, null)
                .withProviderTotal(12, true, Instant.parse("2026-11-01T00:00:00Z")));

        mockMvc.perform(put(url(serie)).contentType("application/json")
                        .content("{\"editionName\":\"kana\",\"totalVolumes\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editionId").value(provider.id().toString()))
                .andExpect(jsonPath("$.totalVolumes").doesNotExist())
                .andExpect(jsonPath("$.totalSource").doesNotExist())
                .andExpect(jsonPath("$.totalCheckedAt").doesNotExist());

        MangaEdition after = mangaEditionRepository.findById(provider.id()).orElseThrow();
        assertThat(after.totalVolumes()).isNull();
        assertThat(after.totalSource()).isNull();
        assertThat(after.totalCheckedAt()).isNull();
    }

    @Test
    void refuses_a_total_below_one_an_ambiguous_edition_and_an_unknown_series() throws Exception {
        Entity serie = serieAvecTomes("Kana");
        serie.addVariant("Tome 1 Perfect", Map.of("volumeNumber", 1, "edition", "Perfect"));
        entityRepository.save(serie);

        mockMvc.perform(put(url(serie)).contentType("application/json")
                        .content("{\"editionName\":\"Kana\",\"totalVolumes\":0}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put(url(serie)).contentType("application/json").content("{\"totalVolumes\":5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Cette série a plusieurs éditions : précise laquelle"));
        mockMvc.perform(put("/api/manga/series/" + UUID.randomUUID() + "/total").contentType("application/json")
                        .content("{\"editionName\":\"Kana\",\"totalVolumes\":5}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void the_old_patch_still_ignores_null_and_keeps_the_source_of_an_unchanged_total() throws Exception {
        Entity serie = serieAvecTomes("Kana");
        MangaEdition provider = mangaEditionRepository.save(MangaEdition.create(serie.id(), serie.title(), "Kana",
                EditionTier.STANDARD, null, null, null, false, false, null)
                .withProviderTotal(12, false, Instant.parse("2026-11-01T00:00:00Z")));
        String patchUrl = "/api/purchase-analysis/editions/" + provider.id();

        mockMvc.perform(patch(patchUrl).contentType("application/json")
                        .content("{\"publisher\":\"Kana\",\"totalVolumes\":12}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVolumes").value(12))
                .andExpect(jsonPath("$.totalSource").value("PROVIDER"));
        mockMvc.perform(patch(patchUrl).contentType("application/json").content("{\"totalVolumes\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVolumes").value(12));
        mockMvc.perform(patch(patchUrl).contentType("application/json").content("{\"totalVolumes\":14}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalSource").value("MANUAL"));
    }

    // ------------------------------------------------------------ V40

    @Test
    void the_migration_round_trips_the_provenance_and_refuses_an_unknown_source() {
        Entity serie = serieAvecTomes("Kana");
        Instant checked = Instant.parse("2026-11-02T08:30:00Z");
        MangaEdition saved = mangaEditionRepository.save(MangaEdition.create(serie.id(), serie.title(), "Kana",
                EditionTier.STANDARD, null, null, null, false, false, null).withProviderTotal(20, true, checked));
        entityManager.flush();
        entityManager.clear();

        MangaEdition read = mangaEditionRepository.findById(saved.id()).orElseThrow();
        assertThat(read.totalSource()).isEqualTo(TotalSource.PROVIDER);
        assertThat(read.frenchRunFinished()).isTrue();
        assertThat(read.totalCheckedAt()).isEqualTo(checked);
        assertThat(jdbc.queryForObject("SELECT total_source FROM manga_edition WHERE id = ?", String.class,
                saved.id())).isEqualTo("PROVIDER");

        assertThatThrownBy(() -> jdbc.update("UPDATE manga_edition SET total_source = 'GUESS' WHERE id = ?",
                saved.id())).hasMessageContaining("manga_edition_total_source_check");
    }
}
