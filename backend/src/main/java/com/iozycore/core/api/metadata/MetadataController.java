package com.iozycore.core.api.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.metadata.BarcodeLookup;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * The two metadata actions common to ALL universes: search by
 * title, recognize a barcode. What only makes sense for a manga
 * (French title, volumes, editions) lives in {@code api.metadata.manga}, and
 * the import of a BGG collection in {@code api.metadata.boardgame} - same
 * split as the {@code metadata} package (Batch 132). The routes did not
 * move: all of them stay under /api/metadata.
 */
@RestController
@RequestMapping("/api/metadata")
@Tag(name = "Metadata", description = "Search of external metadata, all universes: AniList/Jikan/MyAnimeList "
        + "for mangas, BGG for board games, IGDB for video games")
public class MetadataController {

    private final MetadataSearchService metadataSearchService;
    private final EntityTypeRepository entityTypeRepository;

    public MetadataController(MetadataSearchService metadataSearchService, EntityTypeRepository entityTypeRepository) {
        this.metadataSearchService = metadataSearchService;
        this.entityTypeRepository = entityTypeRepository;
    }

    @Operation(summary = "Search metadata candidates to pre-fill the quick add (path 1). "
            + "Titles already in the collection are left out - the goal is to prepare an ADD. "
            + "includeOwned=true keeps them: this is what the reload of the information of an existing "
            + "detail page needs, which looks precisely for an already owned work (see MetadataSearchService.search).")
    @GetMapping("/search")
    public List<MetadataCandidate> search(@RequestParam UUID entityTypeId, @RequestParam String query,
                                           @RequestParam(required = false, defaultValue = "false") boolean includeOwned) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (query == null || query.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'query' est requis");
        }

        return metadataSearchService.search(entityType, query, includeOwned);
    }

    @Operation(summary = "Find the metadata of an item from a scanned barcode (ISBN for mangas)")
    @GetMapping("/lookup-barcode")
    public MetadataCandidate lookupBarcode(@RequestParam UUID entityTypeId, @RequestParam String barcode) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        BarcodeLookup lookup = metadataSearchService.lookupDetailedByBarcode(entityType, barcode);
        if (lookup.candidate() != null) {
            return lookup.candidate();
        }
        // 404 = the databases answered and do not know this code: searching by
        // title is the logical next step. 503 = one of them did not answer, and
        // trying again stays legitimate - two situations that the screen must say
        // differently, and that a single 404 mixed up.
        throw lookup.conclusive()
                ? new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucune métadonnée trouvée pour le code-barres : " + barcode)
                : new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Source de métadonnées indisponible pour le code-barres : " + barcode);
    }
}
