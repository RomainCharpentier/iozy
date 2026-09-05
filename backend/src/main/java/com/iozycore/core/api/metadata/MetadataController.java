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
 * Les deux gestes de métadonnées communs à TOUS les univers : chercher par
 * titre, reconnaître un code-barres. Ce qui n'a de sens que pour un manga
 * (titre français, tomes, éditions) vit dans {@code api.metadata.manga}, et
 * l'import d'une collection BGG dans {@code api.metadata.boardgame} - même
 * découpage que le paquet {@code metadata} (Lot 132). Les routes n'ont pas
 * bougé : toutes restent sous /api/metadata.
 */
@RestController
@RequestMapping("/api/metadata")
@Tag(name = "Metadata", description = "Recherche de métadonnées externes, tous univers : AniList/Jikan/MyAnimeList "
        + "pour les mangas, BGG pour les jeux de société, IGDB pour les jeux vidéo")
public class MetadataController {

    private final MetadataSearchService metadataSearchService;
    private final EntityTypeRepository entityTypeRepository;

    public MetadataController(MetadataSearchService metadataSearchService, EntityTypeRepository entityTypeRepository) {
        this.metadataSearchService = metadataSearchService;
        this.entityTypeRepository = entityTypeRepository;
    }

    @Operation(summary = "Rechercher des candidats de métadonnées pour pré-remplir l'ajout rapide (parcours 1). "
            + "Les titres déjà présents dans la collection sont écartés - le but est de préparer un AJOUT. "
            + "includeOwned=true les garde : c'est ce dont a besoin le rechargement des informations d'une fiche "
            + "existante, qui cherche précisément une œuvre déjà possédée (voir MetadataSearchService.search).")
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

    @Operation(summary = "Retrouver les métadonnées d'un élément à partir d'un code-barres scanné (ISBN pour les mangas)")
    @GetMapping("/lookup-barcode")
    public MetadataCandidate lookupBarcode(@RequestParam UUID entityTypeId, @RequestParam String barcode) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        BarcodeLookup lookup = metadataSearchService.lookupDetailedByBarcode(entityType, barcode);
        if (lookup.candidate() != null) {
            return lookup.candidate();
        }
        // 404 = les bases ont répondu et ne connaissent pas ce code : chercher par
        // titre est la suite logique. 503 = l'une d'elles n'a pas répondu, et le
        // ré-essai reste légitime - deux situations que l'écran doit dire
        // différemment, et qu'un seul 404 confondait.
        throw lookup.conclusive()
                ? new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucune métadonnée trouvée pour le code-barres : " + barcode)
                : new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Source de métadonnées indisponible pour le code-barres : " + barcode);
    }
}
