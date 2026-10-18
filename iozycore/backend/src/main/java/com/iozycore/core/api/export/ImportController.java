package com.iozycore.core.api.export;

import com.iozycore.core.export.ExportDocument;
import com.iozycore.core.export.ImportReport;
import com.iozycore.core.export.ImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The return trip of {@link ExportController}: we send back the JSON file it
 * produced, and the collection is rebuilt in the signed-in account. Two
 * steps, as §19 of docs/CONCEPTION.md wants: <b>analyze</b> says what
 * will be created, attached or ignored without writing anything; <b>apply</b> does it,
 * in one transaction.
 *
 * <p>The body is the export document itself, in JSON - not a multipart
 * file: the browser reads it and sends it back as is, and it is also what
 * a curl script would send.
 */
@RestController
@RequestMapping("/api/import")
@Tag(name = "Import", description = "Re-import a JSON export of the collection - dry run analysis, then application")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    @Operation(summary = "Analyze a JSON export without writing anything: what would be created, attached to what exists, or ignored")
    @PostMapping("/analyse")
    public ImportReport analyser(@RequestBody ExportDocument document) {
        verifier(document);
        return importService.analyser(document, estAdministrateur());
    }

    @Operation(summary = "Apply a JSON export to the collection of the signed-in account (a single transaction)")
    @PostMapping("/appliquer")
    public ImportReport appliquer(@RequestBody ExportDocument document) {
        verifier(document);
        return importService.appliquer(document, estAdministrateur());
    }

    private static void verifier(ExportDocument document) {
        // Any JSON deserializes into an empty document: we refuse what
        // was visibly not produced by the export, rather than
        // reporting "0 everywhere" as if everything was fine.
        if (document == null || (document.entities() == null && document.entityTypes() == null
                && document.editions() == null && document.ownerships() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Ce fichier n'est pas un export IozyCore (aucune section reconnue)");
        }
    }

    /** Same rule as SecurityConfig on /api/tags: only an administrator creates a tag. */
    private static boolean estAdministrateur() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
