package com.iozycore.api.export;

import com.iozycore.export.ExportDocument;
import com.iozycore.export.ImportReport;
import com.iozycore.export.ImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Le retour de {@link ExportController} : on renvoie le fichier JSON qu'il a
 * produit, et la collection se reconstruit dans le compte connecte. Deux
 * temps, comme le veut §19 de docs/CONCEPTION.md : <b>analyser</b> dit ce qui
 * sera cree, rattache ou ignore sans rien ecrire ; <b>appliquer</b> le fait,
 * en une transaction.
 *
 * <p>Le corps est le document d'export lui-meme, en JSON - pas un fichier
 * multipart : le navigateur le lit et le renvoie tel quel, et c'est aussi ce
 * qu'un script curl enverrait.
 */
@RestController
@RequestMapping("/api/import")
@Tag(name = "Import", description = "Reimporter un export JSON de la collection - analyse a blanc, puis application")
public class ImportController {

    private final ImportService importService;

    public ImportController(ImportService importService) {
        this.importService = importService;
    }

    @Operation(summary = "Analyser un export JSON sans rien ecrire : ce qui serait cree, rattache a l'existant, ou ignore")
    @PostMapping("/analyse")
    public ImportReport analyser(@RequestBody ExportDocument document) {
        verifier(document);
        return importService.analyser(document, estAdministrateur());
    }

    @Operation(summary = "Appliquer un export JSON dans la collection du compte connecte (une seule transaction)")
    @PostMapping("/appliquer")
    public ImportReport appliquer(@RequestBody ExportDocument document) {
        verifier(document);
        return importService.appliquer(document, estAdministrateur());
    }

    private static void verifier(ExportDocument document) {
        // Un JSON quelconque se desserialise en document vide : on refuse ce
        // qui n'a visiblement pas ete produit par l'export, plutot que de
        // rapporter "0 partout" comme si tout allait bien.
        if (document == null || (document.entities() == null && document.entityTypes() == null
                && document.editions() == null && document.ownerships() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Ce fichier n'est pas un export IozyCore (aucune section reconnue)");
        }
    }

    /** Meme regle que SecurityConfig sur /api/tags : seul un administrateur cree un tag. */
    private static boolean estAdministrateur() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
