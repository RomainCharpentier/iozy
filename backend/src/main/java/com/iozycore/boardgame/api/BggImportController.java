package com.iozycore.boardgame.api;

import com.iozycore.boardgame.BggCollectionImportService;
import com.iozycore.boardgame.bgg.BggCollectionFetcher.BggCollectionUnavailableException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Board games: the import of a BoardGameGeek collection. Same route
 * as before Batch 132 (/api/metadata/bgg/import), in its own package.
 */
@RestController
@RequestMapping("/api/metadata")
@Tag(name = "Metadata - board games", description = "Import of a BoardGameGeek collection")
public class BggImportController {

    private final BggCollectionImportService bggCollectionImportService;

    public BggImportController(BggCollectionImportService bggCollectionImportService) {
        this.bggCollectionImportService = bggCollectionImportService;
    }

    @Operation(summary = "Bulk import the games marked \"owned\" in a user's BGG collection "
            + "(automatic deduplication through the same mechanism as quick add)")
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
