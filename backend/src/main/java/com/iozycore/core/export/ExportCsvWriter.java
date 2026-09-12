package com.iozycore.core.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Convertit un {@link ExportDocument} en plusieurs fichiers CSV (un par
 * type de ressource), zippés ensemble par ExportController - voir §19,
 * docs/CONCEPTION.md. Volontairement séparé de ExportService (pure
 * transformation, aucune dépendance aux repositories, testable seule).
 * <p>
 * Les attributs libres (JSONB, Map arbitraire) n'ont pas de colonnes fixes
 * communes à tous les types d'Entity - sérialisés en JSON dans une seule
 * cellule plutôt que d'inventer des colonnes qui n'auraient de sens que
 * pour certaines lignes.
 */
@Component
public class ExportCsvWriter {

    private final ObjectMapper objectMapper;

    public ExportCsvWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Map<String, String> writeAll(ExportDocument document) {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("entities.csv", writeCsv(
                List.of("id", "entityTypeCode", "entityTypeLabel", "title", "tags", "attributes"),
                document.entities(),
                e -> List.of(str(e.id()), str(e.entityTypeCode()), str(e.entityTypeLabel()), str(e.title()),
                        String.join(";", e.tagLabels()), toJson(e.attributes()))));

        files.put("variants.csv", writeCsv(
                List.of("id", "entityId", "entityTitle", "label", "attributes", "mangaEditionId"),
                document.entities().stream()
                        .flatMap(e -> e.variants().stream().map(v -> Map.entry(e, v)))
                        .toList(),
                pair -> List.of(str(pair.getValue().id()), str(pair.getKey().id()), str(pair.getKey().title()),
                        str(pair.getValue().label()), toJson(pair.getValue().attributes()),
                        str(pair.getValue().mangaEditionId()))));

        files.put("ownerships.csv", writeCsv(
                List.of("id", "entityId", "entityTitle", "variantId", "variantLabel", "condition", "status",
                        "acquiredAt", "note", "purchasePrice"),
                document.ownerships(),
                o -> List.of(str(o.id()), str(o.entityId()), str(o.entityTitle()), str(o.variantId()),
                        str(o.variantLabel()), str(o.condition()), str(o.status()), str(o.acquiredAt()),
                        str(o.note()), str(o.purchasePrice()))));

        files.put("experiences.csv", writeCsv(
                List.of("id", "entityId", "entityTitle", "variantId", "variantLabel", "experienceType", "occurredAt", "rating", "comment"),
                document.experiences(),
                x -> List.of(str(x.id()), str(x.entityId()), str(x.entityTitle()), str(x.variantId()), str(x.variantLabel()),
                        str(x.experienceType()), str(x.occurredAt()), str(x.rating()), str(x.comment()))));

        files.put("wishlist.csv", writeCsv(
                List.of("id", "entityId", "entityTitle", "variantId", "variantLabel", "addedAt"),
                document.wishlist(),
                w -> List.of(str(w.id()), str(w.entityId()), str(w.entityTitle()), str(w.variantId()),
                        str(w.variantLabel()), str(w.addedAt()))));

        files.put("followed-works.csv", writeCsv(
                List.of("entityId", "entityTitle", "followedAt"),
                document.followedWorks(),
                f -> List.of(str(f.entityId()), str(f.entityTitle()), str(f.followedAt()))));

        files.put("relationships.csv", writeCsv(
                List.of("id", "sourceEntityId", "sourceEntityTitle", "targetEntityId", "targetEntityTitle", "relationshipType"),
                document.relationships(),
                r -> List.of(str(r.id()), str(r.sourceEntityId()), str(r.sourceEntityTitle()), str(r.targetEntityId()),
                        str(r.targetEntityTitle()), str(r.relationshipType()))));

        files.put("editions.csv", writeCsv(
                List.of("id", "entityId", "seriesTitle", "editionName", "tier", "publisher", "totalVolumes",
                        "retailPriceNewPerVolume", "outOfPrint", "betterEditionAnnounced", "betterEditionNote",
                        "languageCode"),
                document.editions(),
                e -> List.of(str(e.id()), str(e.entityId()), str(e.seriesTitle()), str(e.editionName()),
                        str(e.tier()), str(e.publisher()), str(e.totalVolumes()), str(e.retailPriceNewPerVolume()),
                        str(e.outOfPrint()), str(e.betterEditionAnnounced()), str(e.betterEditionNote()),
                        str(e.languageCode()))));

        files.put("general-rankings.csv", writeCsv(
                List.of("entityId", "entityTitle", "rank"),
                document.generalRankings(),
                r -> List.of(str(r.entityId()), str(r.entityTitle()), str(r.rank()))));

        // Une ligne par ŒUVRE classée, la liste étant répétée en colonnes : un
        // CSV imbriqué n'existe pas, et c'est le classement qu'on vient lire.
        files.put("tier-lists.csv", writeCsv(
                List.of("tierListId", "tierListName", "entityTypeLabel", "activeRanks", "entityId", "entityTitle", "rank"),
                document.tierLists().stream()
                        .flatMap(l -> l.items().stream().map(i -> Map.entry(l, i)))
                        .toList(),
                pair -> List.of(str(pair.getKey().id()), str(pair.getKey().name()),
                        str(pair.getKey().entityTypeLabel()), String.join(";", pair.getKey().activeRanks()),
                        str(pair.getValue().entityId()), str(pair.getValue().entityTitle()),
                        str(pair.getValue().rank()))));

        files.put("tags.csv", writeCsv(
                List.of("id", "label"),
                document.tags(),
                t -> List.of(str(t.id()), str(t.label()))));

        files.put("market-observations.csv", writeCsv(
                List.of("id", "mangaEditionId", "seriesTitle", "editionName", "volumeRangeStart", "volumeRangeEnd",
                        "volumeCount", "observedPrice", "platform", "observedCondition", "observedAt", "origin",
                        "sourceUrl", "note"),
                document.marketObservations(),
                o -> List.of(str(o.id()), str(o.mangaEditionId()), str(o.seriesTitle()), str(o.editionName()),
                        str(o.volumeRangeStart()), str(o.volumeRangeEnd()), str(o.volumeCount()),
                        str(o.observedPrice()), str(o.platform()), str(o.observedCondition()), str(o.observedAt()),
                        str(o.origin()), str(o.sourceUrl()), str(o.note()))));

        files.put("followed-editions.csv", writeCsv(
                List.of("id", "entityId", "entityTitle", "editionName", "followedAt"),
                document.followedEditions(),
                f -> List.of(str(f.id()), str(f.entityId()), str(f.entityTitle()), str(f.editionName()),
                        str(f.followedAt()))));

        files.put("entity-types.csv", writeCsv(
                List.of("id", "code", "label", "allowedExperienceTypes", "customFieldKeys", "colorKey", "iconKey",
                        "aspectKey"),
                document.entityTypes(),
                t -> List.of(str(t.id()), str(t.code()), str(t.label()),
                        String.join(";", t.allowedExperienceTypes()), String.join(";", t.customFieldKeys()),
                        str(t.colorKey()), str(t.iconKey()), str(t.aspectKey()))));

        // Une seule ligne : ce profil est unique (application mono-utilisateur,
        // voir CollectorPreferences). Un CSV d'une ligne reste plus lisible
        // qu'un JSON noye dans un autre fichier.
        ExportDocument.CollectorPreferencesExport prefs = document.collectorPreferences();
        files.put("collector-preferences.csv", writeCsv(
                List.of("editionTierRanking", "avoidOutdatedEditionWhenBetterExistsOrAnnounced",
                        "conditionImportance", "minimumDiscountVsRetailPercent", "factorWeights"),
                prefs == null ? List.<ExportDocument.CollectorPreferencesExport>of() : List.of(prefs),
                p -> List.of(String.join(";", p.editionTierRanking()),
                        str(p.avoidOutdatedEditionWhenBetterExistsOrAnnounced()), str(p.conditionImportance()),
                        str(p.minimumDiscountVsRetailPercent()), toJson(p.factorWeights()))));

        return files;
    }

    private <T> String writeCsv(List<String> header, List<T> rows, Function<T, List<String>> toRow) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", header.stream().map(this::escape).toList())).append("\n");
        for (T row : rows) {
            sb.append(String.join(",", toRow.apply(row).stream().map(this::escape).toList())).append("\n");
        }
        return sb.toString();
    }

    private static String str(Object value) {
        return value == null ? "" : value.toString();
    }

    private String toJson(Object value) {
        if (value == null || (value instanceof Map<?, ?> map && map.isEmpty())) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "";
        }
    }

    /** RFC4180 minimal : entoure de guillemets si la valeur contient une virgule, un guillemet ou un retour à la ligne. */
    private String escape(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
