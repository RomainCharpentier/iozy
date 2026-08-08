package com.iozycore.api.metadata;

import com.iozycore.application.BggCollectionImportService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataSearchService;
import com.iozycore.metadata.VolumeCandidate;
import com.iozycore.metadata.VolumeSearchResult;
import com.iozycore.metadata.bgg.BggCollectionFetcher.BggCollectionUnavailableException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/metadata")
@Tag(name = "Metadata", description = "Recherche de métadonnées externes (Jikan pour les mangas, "
        + "BGG pour les jeux de société, IGDB pour les jeux vidéo)")
public class MetadataController {

    private final MetadataSearchService metadataSearchService;
    private final BggCollectionImportService bggCollectionImportService;
    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;

    public MetadataController(MetadataSearchService metadataSearchService,
                               BggCollectionImportService bggCollectionImportService,
                               EntityTypeRepository entityTypeRepository,
                               EntityRepository entityRepository,
                               OwnershipRepository ownershipRepository) {
        this.metadataSearchService = metadataSearchService;
        this.bggCollectionImportService = bggCollectionImportService;
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
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

    /** Un tome trouvé (voir VolumeCandidate), enrichi de alreadyOwned - vrai si
     * une Ownership active référence déjà un Variant de la série existante
     * correspondant à cette édition+ce numéro de tome. Ce croisement se fait
     * ici (couche présentation), jamais dans MetadataSearchService qui ne
     * connaît que des sources externes, jamais la collection de l'utilisateur. */
    public record VolumeCandidateResponse(String edition, int volumeNumber, String imageUrl, String title, boolean alreadyOwned) {
        static VolumeCandidateResponse from(VolumeCandidate candidate, boolean alreadyOwned) {
            return new VolumeCandidateResponse(
                    candidate.edition(), candidate.volumeNumber(), candidate.imageUrl(), candidate.title(), alreadyOwned);
        }
    }

    /** {@code quotaExceeded} distingue une liste vide "aucune édition
     * trouvée" d'un quota Google Books dépassé sur toutes les clés
     * configurées (voir VolumeSearchResult) - le client peut alors afficher
     * un message adapté ("réessaie plus tard") plutôt que de laisser croire
     * à tort que la série n'a aucune édition française. */
    public record VolumesResponse(List<VolumeCandidateResponse> volumes, boolean quotaExceeded) {
    }

    @Operation(summary = "Recherche best-effort des tomes réels (avec jaquette) des éditions françaises d'une "
            + "série (Google Books) - pour proposer une sélection visuelle des tomes possédés plutôt qu'une saisie "
            + "manuelle du numéro de tome. alreadyOwned indique les tomes déjà possédés (Ownership active sur le "
            + "Variant correspondant, si la série existe déjà dans la collection). volumes vide si rien trouvé "
            + "(jamais une erreur) : le client garde alors le parcours de saisie manuelle - quotaExceeded distingue "
            + "ce cas d'un quota Google Books dépassé. Résultat stocké durablement (voir V3__volume_search_cache.sql) - "
            + "un résultat une fois trouvé n'est plus jamais rappelé automatiquement, forceRefresh=true (bouton "
            + "'Actualiser' côté client) est le seul moyen de relancer les requêtes Google Books derrière ce "
            + "candidat - voir MetadataSearchService.searchVolumes. Recherche par défaut limitée à quelques mots-clés "
            + "d'édition courants ; deepSearch=true (bouton 'Chercher plus d'éditions') fusionne avec les mots-clés "
            + "plus rares (voir MetadataSearchService.searchAdditionalEditions) - incompatible avec forceRefresh, "
            + "deepSearch est alors prioritaire.")
    @GetMapping("/volumes")
    public VolumesResponse volumes(@RequestParam UUID entityTypeId, @RequestParam String title,
                                    @RequestParam(required = false) String author,
                                    @RequestParam(required = false, defaultValue = "false") boolean forceRefresh,
                                    @RequestParam(required = false, defaultValue = "false") boolean deepSearch) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'title' est requis");
        }

        VolumeSearchResult searchResult = deepSearch
                ? metadataSearchService.searchAdditionalEditions(entityType, title, author)
                : metadataSearchService.searchVolumes(entityType, title, author, forceRefresh);
        Set<String> ownedKeys = alreadyOwnedVariantKeys(entityTypeId, title);

        List<VolumeCandidateResponse> candidates = searchResult.volumes().stream()
                .map(candidate -> VolumeCandidateResponse.from(candidate, ownedKeys.contains(variantKey(candidate.edition(), candidate.volumeNumber()))))
                .collect(Collectors.toList());
        return new VolumesResponse(candidates, searchResult.quotaExceeded());
    }

    /** Clés "édition|tome" (normalisées) des Variant de la série {@code title}
     * (si elle existe déjà) référencés par au moins une Ownership active -
     * vide si la série n'a jamais été ajoutée, ce qui est le cas le plus
     * fréquent (on cherche des tomes avant même de savoir si on en possède déjà). */
    private Set<String> alreadyOwnedVariantKeys(UUID entityTypeId, String title) {
        Optional<Entity> existingEntity = entityRepository.findByTypeAndTitle(entityTypeId, title.trim());
        if (existingEntity.isEmpty()) {
            return Set.of();
        }
        Entity entity = existingEntity.get();
        Set<UUID> activeVariantIds = ownershipRepository.findByEntityId(entity.id()).stream()
                .filter(Ownership::isActive)
                .map(Ownership::variantId)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toSet());

        return entity.variants().stream()
                .filter(variant -> activeVariantIds.contains(variant.id()))
                .map(this::variantKey)
                .collect(Collectors.toSet());
    }

    private String variantKey(Variant variant) {
        Object volumeNumber = variant.attributes().get("volumeNumber");
        Object edition = variant.attributes().get("edition");
        if (!(volumeNumber instanceof Number number)) {
            return "unknown|" + variant.id(); // tome sans numéro exploitable - ne matchera jamais un VolumeCandidate, sans effet de bord
        }
        return variantKey(edition == null ? "" : edition.toString(), number.intValue());
    }

    private String variantKey(String edition, int volumeNumber) {
        return edition.trim().toLowerCase() + "|" + volumeNumber;
    }
}
