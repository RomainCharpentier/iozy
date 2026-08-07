package com.iozycore.api.metadata;

import com.iozycore.application.BggCollectionImportService;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataSearchService;
import com.iozycore.metadata.bgg.BggCollectionFetcher.BggCollectionUnavailableException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/metadata")
@Tag(name = "Metadata", description = "Recherche de métadonnées externes (Jikan pour les mangas, "
        + "BGG pour les jeux de société, IGDB pour les jeux vidéo)")
public class MetadataController {

    private final MetadataSearchService metadataSearchService;
    private final BggCollectionImportService bggCollectionImportService;
    private final EntityTypeRepository entityTypeRepository;

    public MetadataController(MetadataSearchService metadataSearchService,
                               BggCollectionImportService bggCollectionImportService,
                               EntityTypeRepository entityTypeRepository) {
        this.metadataSearchService = metadataSearchService;
        this.bggCollectionImportService = bggCollectionImportService;
        this.entityTypeRepository = entityTypeRepository;
    }

    @Operation(summary = "Rechercher des candidats de métadonnées pour pré-remplir l'ajout rapide (parcours 1)")
    @GetMapping("/search")
    public List<MetadataCandidate> search(@RequestParam UUID entityTypeId, @RequestParam String query) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (query == null || query.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'query' est requis");
        }

        return metadataSearchService.search(entityType, query);
    }

    @Operation(summary = "Retrouver les métadonnées d'un élément à partir d'un code-barres scanné (ISBN pour les mangas)")
    @GetMapping("/lookup-barcode")
    public MetadataCandidate lookupBarcode(@RequestParam UUID entityTypeId, @RequestParam String barcode) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        return metadataSearchService.lookupByBarcode(entityType, barcode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucune métadonnée trouvée pour le code-barres : " + barcode));
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

    @Operation(summary = "Recherche best-effort d'un titre d'édition française (Open Library, puis Google Books en "
            + "repli) pour un titre déjà choisi (mangas) - ni Jikan ni MyAnimeList n'en connaissent. Déclenché "
            + "uniquement à la sélection d'une suggestion côté client, jamais pour toute une liste de résultats de "
            + "recherche (coût en appels externes) - voir MetadataSearchService.findFrenchTitle. 404 si rien "
            + "trouvé, pas une erreur : le client retombe alors sur le titre anglais/romaji déjà affiché.")
    @GetMapping("/french-title")
    public FrenchTitleResponse frenchTitle(@RequestParam UUID entityTypeId, @RequestParam String query,
                                            @RequestParam(required = false) String author) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (query == null || query.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'query' est requis");
        }

        return metadataSearchService.findFrenchTitle(entityType, query, author)
                .map(FrenchTitleResponse::new)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucun titre français trouvé pour : " + query));
    }

    public record FrenchTitleResponse(String frenchTitle) {
    }
}
