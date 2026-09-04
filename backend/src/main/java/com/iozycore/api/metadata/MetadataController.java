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
import com.iozycore.metadata.BarcodeLookup;
import com.iozycore.metadata.MetadataSearchService;
import com.iozycore.metadata.RelatedSeriesService;
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
    private final RelatedSeriesService relatedSeriesService;
    private final BggCollectionImportService bggCollectionImportService;
    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;

    public MetadataController(MetadataSearchService metadataSearchService,
                               RelatedSeriesService relatedSeriesService,
                               BggCollectionImportService bggCollectionImportService,
                               EntityTypeRepository entityTypeRepository,
                               EntityRepository entityRepository,
                               OwnershipRepository ownershipRepository) {
        this.metadataSearchService = metadataSearchService;
        this.relatedSeriesService = relatedSeriesService;
        this.bggCollectionImportService = bggCollectionImportService;
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
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
            + "trouvé, pas une erreur : le client retombe alors sur le titre anglais/romaji déjà affiché - c'est "
            + "aussi la réponse quand le seul titre candidat vient du dernier recours \"auteur seul\" et se "
            + "révèle être le titre catalogué d'une AUTRE œuvre du même auteur (voir "
            + "MetadataSearchService.namesAnotherKnownWork). malId "
            + "(déjà connu du candidat sélectionné) permet d'écarter une suite/spin-off connu(e) (voir "
            + "RelatedSeriesService) mal résolu(e) à la place du titre cherché - ex: \"Dragon Ball Super\" pour "
            + "\"Dragon Ball\" - best-effort, sans effet si absent. titleRomaji (voir "
            + "MyAnimeListMetadataProvider.titleRomaji) est essayé en repli de 'query' pour cette même détection "
            + "quand un spin-off est indexé sous le titre romaji plutôt que le titre affiché (ex: \"Attack on "
            + "Titan\"/\"Shingeki no Kyojin\").")
    @GetMapping("/french-title")
    public FrenchTitleResponse frenchTitle(@RequestParam UUID entityTypeId, @RequestParam String query,
                                            @RequestParam(required = false) String author,
                                            @RequestParam(required = false) String malId,
                                            @RequestParam(required = false) String titleRomaji) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (query == null || query.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'query' est requis");
        }

        List<String> excludedTitleFragments = relatedSeriesService.findExcludedTitleFragments(entityType, malId, query, titleRomaji);
        return metadataSearchService.findFrenchTitle(entityType, query, author, excludedTitleFragments, malId)
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
     * trouvée" d'un échec TRANSITOIRE du fournisseur externe - quota dépassé
     * sur toutes les clés configurées, ou source qui n'a pas répondu du tout
     * (voir VolumeSearchResult) - le client peut alors afficher un message
     * adapté ("réessaie plus tard") plutôt que de laisser croire à tort que
     * la série n'a aucune édition française.
     * <p>
     * Le nom du champ dit "quota" et couvre désormais les deux causes : il
     * est déjà décodé tel quel par le client iOS (voir
     * APIClient+Collections.swift), le renommer casserait sa lecture pour un
     * gain purement cosmétique - le drapeau se nomme {@code
     * providerUnavailable} partout ailleurs, côté serveur. */
    public record VolumesResponse(List<VolumeCandidateResponse> volumes, boolean quotaExceeded) {
    }

    @Operation(summary = "Recherche best-effort des tomes réels (avec jaquette) des éditions françaises d'une "
            + "série (Google Books) - pour proposer une sélection visuelle des tomes possédés plutôt qu'une saisie "
            + "manuelle du numéro de tome. alreadyOwned indique les tomes déjà possédés (Ownership active sur le "
            + "Variant correspondant, si la série existe déjà dans la collection). volumes vide si rien trouvé "
            + "(jamais une erreur) : le client garde alors le parcours de saisie manuelle - quotaExceeded distingue "
            + "ce cas d'un échec transitoire du fournisseur (quota dépassé, ou source qui n'a pas répondu). Résultat stocké durablement (voir V3__volume_search_cache.sql) - "
            + "un résultat une fois trouvé n'est plus jamais rappelé automatiquement, forceRefresh=true (bouton "
            + "'Actualiser' côté client) est le seul moyen de relancer les requêtes Google Books derrière ce "
            + "candidat - voir MetadataSearchService.searchVolumes. Recherche par défaut limitée à quelques mots-clés "
            + "d'édition courants ; deepSearch=true (bouton 'Chercher plus d'éditions') fusionne avec les mots-clés "
            + "plus rares (voir MetadataSearchService.searchAdditionalEditions) - incompatible avec forceRefresh, "
            + "deepSearch est alors prioritaire. malId+originalTitle (déjà connus du candidat sélectionné) "
            + "permettent d'écarter un spin-off/side-story connu (voir RelatedSeriesService) publié sous un titre "
            + "structurellement identique à une vraie édition - best-effort, sans effet si l'un des deux manque. "
            + "titleRomaji est essayé en repli d'originalTitle pour cette même détection (voir /french-title).")
    @GetMapping("/volumes")
    public VolumesResponse volumes(@RequestParam UUID entityTypeId, @RequestParam String title,
                                    @RequestParam(required = false) String author,
                                    @RequestParam(required = false, defaultValue = "false") boolean forceRefresh,
                                    @RequestParam(required = false, defaultValue = "false") boolean deepSearch,
                                    @RequestParam(required = false) String malId,
                                    @RequestParam(required = false) String originalTitle,
                                    @RequestParam(required = false) String titleRomaji,
                                    @RequestParam(required = false) Integer totalVolumes) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'title' est requis");
        }

        List<String> excludedTitleFragments = relatedSeriesService.findExcludedTitleFragments(entityType, malId, originalTitle, titleRomaji);
        VolumeSearchResult searchResult = deepSearch
                ? metadataSearchService.searchAdditionalEditions(entityType, title, author, excludedTitleFragments)
                : metadataSearchService.searchVolumes(entityType, title, author, forceRefresh, excludedTitleFragments, totalVolumes);
        Set<String> ownedKeys = alreadyOwnedVariantKeys(entityTypeId, title);

        // Tries par numero, et le tri est STABLE : les editions gardent l'ordre
        // de leur premiere apparition (celle du fournisseur en tete), seuls
        // les tomes se rangent. Google Books rendait ses tomes deja en ordre,
        // la BnF les rend dans l'ordre de son catalogue - constate sur Boruto
        // (09, 03, 02, 08, 01, 18, 17) le jour ou elle est passee en premier.
        List<VolumeCandidateResponse> candidates = searchResult.volumes().stream()
                .sorted(java.util.Comparator.comparingInt(VolumeCandidate::volumeNumber))
                .map(candidate -> VolumeCandidateResponse.from(candidate, ownedKeys.contains(variantKey(candidate.edition(), candidate.volumeNumber()))))
                .collect(Collectors.toList());
        return new VolumesResponse(candidates, searchResult.providerUnavailable());
    }

    public record SeriesSansTomesRequest(UUID entityTypeId, List<SerieInterrogee> series) {
    }

    public record SerieInterrogee(String title, String author) {
    }

    /**
     * Parmi ces séries, lesquelles sait-on DÉJÀ sans aucun tome ?
     * <p>
     * Répond depuis le seul cache durable des recherches de tomes, sans jamais
     * appeler de fournisseur : c'est ce qui rend cette question utilisable sur
     * une liste de résultats de recherche, là où la poser vraiment coûterait
     * huit requêtes Google Books PAR SÉRIE (voir GoogleBooksVolumeSearchProvider)
     * et épuiserait le quota en quelques frappes.
     * <p>
     * Conséquence assumée : une série jamais recherchée n'est pas signalée. On
     * ne confond pas « on sait qu'il n'y en a pas » avec « on ne sait pas
     * encore » - signaler la seconde reviendrait à marquer tout le catalogue.
     * <p>
     * POST et non GET : la question porte sur une LISTE de couples
     * (titre, auteur), dont des titres japonais et à ponctuation - les faire
     * tenir dans une query string serait fragile pour une requête qui ne
     * modifie rien mais ne se met de toute façon pas en cache HTTP.
     */
    @Operation(summary = "Parmi ces séries, lesquelles sont déjà connues comme n'ayant aucun tome "
            + "(cache uniquement, aucun appel à un fournisseur externe)")
    @PostMapping("/volumes/known-empty")
    public List<SerieInterrogee> volumesKnownEmpty(@RequestBody SeriesSansTomesRequest request) {
        EntityType entityType = entityTypeRepository.findById(request.entityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "EntityType inconnu : " + request.entityTypeId()));
        if (request.series() == null) {
            return List.of();
        }
        return request.series().stream()
                .filter(serie -> serie.title() != null && !serie.title().isBlank())
                .filter(serie -> metadataSearchService.isVolumeSearchKnownEmpty(entityType, serie.title(), serie.author()))
                .collect(Collectors.toList());
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

    /** La même identité que celle d'un {@link VolumeCandidate} - c'est
     *  précisément ce qui permet de dire « ce tome-là, tu l'as déjà ». */
    private String variantKey(String edition, int volumeNumber) {
        return VolumeCandidate.key(edition, volumeNumber);
    }
}
