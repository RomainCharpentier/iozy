package com.iozycore.api.export;

import com.iozycore.export.ExportCsvWriter;
import com.iozycore.export.ExportDocument;
import com.iozycore.export.ExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * "Export complet des données (JSON/CSV)" (§19, docs/CONCEPTION.md) -
 * anti-enfermement, même auto-hébergé : toute la collection téléchargeable
 * en un clic, dans un format ouvert et lisible sans l'app (voir
 * ExportDocument/ExportCsvWriter). Lecture seule, aucun état modifié.
 */
@RestController
@RequestMapping("/api/export")
@Tag(name = "Export", description = "Export complet de la collection (anti-enfermement) - JSON ou CSV/ZIP")
public class ExportController {

    private final ExportService exportService;
    private final ExportCsvWriter csvWriter;

    public ExportController(ExportService exportService, ExportCsvWriter csvWriter) {
        this.exportService = exportService;
        this.csvWriter = csvWriter;
    }

    @Operation(summary = "Export JSON complet de la collection (entités, tomes/variants, possessions, "
            + "expériences, wishlist, relations, tags) - un seul fichier auto-suffisant")
    @GetMapping("/json")
    public ResponseEntity<ExportDocument> json() {
        ExportDocument document = exportService.buildExportDocument();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName("json")).build().toString())
                .body(document);
    }

    @Operation(summary = "Export CSV complet de la collection - un fichier .zip contenant un .csv par type "
            + "de ressource (entities, variants, ownerships, experiences, wishlist, relationships, tags)")
    @GetMapping("/csv")
    public ResponseEntity<byte[]> csv() {
        ExportDocument document = exportService.buildExportDocument();
        Map<String, String> csvFiles = csvWriter.writeAll(document);

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            for (Map.Entry<String, String> file : csvFiles.entrySet()) {
                zip.putNextEntry(new ZipEntry(file.getKey()));
                zip.write(file.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Échec de la génération de l'export CSV");
        }

        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fileName("zip")).build().toString())
                .body(buffer.toByteArray());
    }

    private static String fileName(String extension) {
        return "iozycore-export-" + LocalDate.now() + "." + extension;
    }
}
