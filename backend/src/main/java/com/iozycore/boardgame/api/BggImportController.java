package com.iozycore.boardgame.api;

import com.iozycore.boardgame.BggCollectionImportService;
import com.iozycore.boardgame.bgg.BggCollectionFetcher.BggCollectionUnavailableException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Les jeux de société : l'import d'une collection BoardGameGeek. Même route
 * qu'avant le Lot 132 (/api/metadata/bgg/import), dans son propre paquet.
 */
@RestController
@RequestMapping("/api/metadata")
@Tag(name = "Metadata - jeux de société", description = "Import d'une collection BoardGameGeek")
public class BggImportController {

    private final BggCollectionImportService bggCollectionImportService;

    public BggImportController(BggCollectionImportService bggCollectionImportService) {
        this.bggCollectionImportService = bggCollectionImportService;
    }

    @Operation(summary = "Importer en masse les jeux marqués \"possédés\" de la collection BGG d'un utilisateur "
            + "(déduplication automatique via le même mécanisme que l'ajout rapide)")
    @PostMapping("/bgg/import")
    public BggCollectionImportService.ImportResult importBggCollection(@RequestParam String username) {
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'username' est requis");
        }
        try {
            return bggCollectionImportService.importOwnedGames(username);
        } catch (BggCollectionUnavailableException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }
}
