package com.iozycore.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ExportCsvWriterTest {

    private final ExportCsvWriter writer = new ExportCsvWriter(new ObjectMapper());

    private ExportDocument.EntityExport sampleEntity(UUID id) {
        return new ExportDocument.EntityExport(id, "MANGA", "Manga", "Death Note",
                Map.of("mangaka", "Takeshi Obata"), List.of("seinen"),
                List.of(new ExportDocument.VariantExport(UUID.randomUUID(), "Tome 1", Map.of("volumeNumber", 1))));
    }

    @Test
    void writes_one_csv_file_per_resource_type() {
        Map<String, String> files = writer.writeAll(new ExportDocument("2026-08-11T00:00:00Z",
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of()));

        // Quatre familles ajoutées au Lot 33 : saisies à la main et pourtant
        // absentes de l'export, dont les éditions de référence sans lesquelles
        // aucun "X sur Y" ne peut être reconstruit.
        assertThat(files.keySet()).containsExactlyInAnyOrder(
                "entities.csv", "variants.csv", "ownerships.csv", "experiences.csv",
                "wishlist.csv", "relationships.csv", "tags.csv",
                "editions.csv", "general-rankings.csv", "tier-lists.csv", "edition-upgrade-wishes.csv");
    }

    @Test
    void entities_csv_includes_a_header_and_serializes_attributes_and_tags() {
        UUID entityId = UUID.randomUUID();
        ExportDocument document = new ExportDocument("2026-08-11T00:00:00Z",
                List.of(sampleEntity(entityId)), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of());

        String csv = writer.writeAll(document).get("entities.csv");
        List<String> lines = List.of(csv.strip().split("\n"));

        assertThat(lines.get(0)).isEqualTo("id,entityTypeCode,entityTypeLabel,title,tags,attributes");
        assertThat(lines.get(1)).contains(entityId.toString(), "MANGA", "Death Note", "seinen", "Takeshi Obata");
    }

    @Test
    void variants_are_flattened_one_row_per_variant_with_the_parent_entity_context() {
        ExportDocument document = new ExportDocument("2026-08-11T00:00:00Z",
                List.of(sampleEntity(UUID.randomUUID())), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of());

        String csv = writer.writeAll(document).get("variants.csv");
        List<String> lines = List.of(csv.strip().split("\n"));

        assertThat(lines).hasSize(2); // header + 1 variant
        assertThat(lines.get(1)).contains("Tome 1", "Death Note");
    }

    @Test
    void a_value_containing_a_comma_or_quote_is_escaped_per_rfc4180() {
        ExportDocument.OwnershipExport ownership = new ExportDocument.OwnershipExport(
                UUID.randomUUID(), UUID.randomUUID(), "Death Note", null, null, "NEW", "OWNED",
                LocalDate.now(), "Acheté \"pas cher\", en lot", new BigDecimal("6.90"));
        ExportDocument document = new ExportDocument("2026-08-11T00:00:00Z",
                List.of(), List.of(ownership), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of());

        String csv = writer.writeAll(document).get("ownerships.csv");

        assertThat(csv).contains("\"Acheté \"\"pas cher\"\", en lot\"");
    }

    @Test
    void empty_attributes_produce_an_empty_cell_rather_than_a_literal_empty_object() {
        ExportDocument.EntityExport entity = new ExportDocument.EntityExport(
                UUID.randomUUID(), "MANGA", "Manga", "Sans attributs", Map.of(), List.of(), List.of());
        ExportDocument document = new ExportDocument("2026-08-11T00:00:00Z",
                List.of(entity), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of());

        String csv = writer.writeAll(document).get("entities.csv");

        assertThat(csv).doesNotContain("{}");
    }
}
