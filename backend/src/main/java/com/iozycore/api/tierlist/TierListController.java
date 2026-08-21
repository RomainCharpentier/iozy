package com.iozycore.api.tierlist;

import com.iozycore.api.dto.TierListDtos.*;
import com.iozycore.application.TierListService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.tierlist.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Tier Lists : classement général (une œuvre = un rang sur l'échelle
 * complète, voir /general) et Tier Lists personnalisées (nommées,
 * appartenance explicite, voir le reste des routes) - voir la maquette
 * V1.2 §44-52 et com.iozycore.domain.tierlist. Nouveau domaine, aucune
 * donnée héritée à migrer (voir docs/DESIGN_MIGRATION_V1.2.md Lot 7).
 */
@RestController
@RequestMapping("/api/tier-lists")
@Tag(name = "Tier Lists", description = "Classement général et Tier Lists personnalisées")
public class TierListController {

    private final TierListRepository tierListRepository;
    private final TierListItemRepository tierListItemRepository;
    private final EntityRankRepository entityRankRepository;
    private final EntityRepository entityRepository;
    private final TierListService tierListService;

    public TierListController(TierListRepository tierListRepository, TierListItemRepository tierListItemRepository,
                               EntityRankRepository entityRankRepository, EntityRepository entityRepository,
                               TierListService tierListService) {
        this.tierListRepository = tierListRepository;
        this.tierListItemRepository = tierListItemRepository;
        this.entityRankRepository = entityRankRepository;
        this.entityRepository = entityRepository;
        this.tierListService = tierListService;
    }

    // ═══ Classement général ═══

    @Operation(summary = "Board du classement général d'un univers (voir TierBoard côté maquette)")
    @GetMapping("/general")
    public GeneralBoardResponse generalBoard(@RequestParam UUID entityTypeId) {
        TierListService.GeneralBoard board = tierListService.generalBoard(entityTypeId);
        Map<Rank, List<TierListEntryResponse>> ranked = new EnumMap<>(Rank.class);
        board.ranked().forEach((rank, entities) -> ranked.put(rank,
                entities.stream().map(e -> TierListEntryResponse.from(e, rank)).collect(Collectors.toList())));
        List<TierListEntryResponse> unranked = board.unranked().stream()
                .map(e -> TierListEntryResponse.from(e, null))
                .collect(Collectors.toList());
        return new GeneralBoardResponse(ranked, unranked);
    }

    @Operation(summary = "Classer (ou déclasser si rank=null) une œuvre sur le classement général")
    @PutMapping("/general/entities/{entityId}")
    public TierListEntryResponse setGeneralRank(@PathVariable UUID entityId, @RequestBody SetRankRequest request) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entité introuvable : " + entityId));
        if (request.rank() == null) {
            entityRankRepository.deleteByEntityId(entityId);
            return TierListEntryResponse.from(entity, null);
        }
        EntityRank rank = entityRankRepository.findByEntityId(entityId)
                .map(existing -> {
                    existing.updateRank(request.rank());
                    return existing;
                })
                .orElseGet(() -> EntityRank.assign(entityId, request.rank()));
        entityRankRepository.save(rank);
        return TierListEntryResponse.from(entity, request.rank());
    }

    @Operation(summary = "\"Mes classements\" d'une œuvre (rang général + Tier Lists personnalisées où elle est classée)")
    @GetMapping("/entities/{entityId}/summary")
    public EntityTierSummaryResponse entitySummary(@PathVariable UUID entityId) {
        Rank generalRank = entityRankRepository.findByEntityId(entityId).map(EntityRank::rank).orElse(null);
        List<CustomRankEntryResponse> customRanks = tierListService.customRanksFor(entityId).stream()
                .map(entry -> new CustomRankEntryResponse(entry.list().id(), entry.list().name(), entry.rank()))
                .collect(Collectors.toList());
        return new EntityTierSummaryResponse(generalRank, customRanks);
    }

    // ═══ Tier Lists personnalisées ═══

    @Operation(summary = "Tier Lists personnalisées d'un univers (Hub Découvrir). entityTypeId omis = les Tier "
            + "Lists TRANSVERSES \"toutes catégories\" (voir TierList.isAllUniverses), jamais toutes les listes "
            + "confondues : elles forment une famille à part côté client, pas un univers de plus.")
    @GetMapping
    public List<TierListResponse> byEntityType(@RequestParam(required = false) UUID entityTypeId) {
        List<TierList> lists = entityTypeId == null
                ? tierListRepository.findAllUniversesLists()
                : tierListRepository.findByEntityTypeId(entityTypeId);
        return lists.stream().map(this::toSummary).collect(Collectors.toList());
    }

    @Operation(summary = "Créer une Tier List personnalisée")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TierListResponse create(@RequestBody CreateTierListRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom de la Tier List ne peut pas être vide");
        }
        // entityTypeId null = liste transverse "toutes catégories" (voir TierList) -
        // rien à valider dans ce cas, il n'y a justement pas d'univers.
        if (request.entityTypeId() != null) {
            entityRepository.findAllByType(request.entityTypeId()); // valide implicitement l'existence du type (liste vide sinon, pas d'exception)
        }
        TierList list = TierList.create(request.name(), request.entityTypeId(), request.activeRanks(), request.description());
        return toSummary(tierListRepository.save(list));
    }

    @Operation(summary = "Détail d'une Tier List (board complet, classés et non classés)")
    @GetMapping("/{id}")
    public TierListDetailResponse detail(@PathVariable UUID id) {
        TierList list = requireTierList(id);
        List<Map.Entry<TierListItem, Entity>> entries = tierListService.enrichedItems(id);
        List<TierListEntryResponse> ranked = entries.stream()
                .filter(e -> e.getKey().rank().isPresent())
                .sorted(Comparator.comparing(e -> e.getKey().rank().get()))
                .map(e -> TierListEntryResponse.from(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
        List<TierListEntryResponse> unranked = entries.stream()
                .filter(e -> e.getKey().rank().isEmpty())
                .map(e -> TierListEntryResponse.from(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
        return new TierListDetailResponse(toSummary(list), ranked, unranked);
    }

    @Operation(summary = "Renommer / modifier les rangs actifs / la description d'une Tier List")
    @PatchMapping("/{id}")
    public TierListResponse update(@PathVariable UUID id, @RequestBody UpdateTierListRequest request) {
        TierList list = requireTierList(id);
        if (request.name() != null) list.rename(request.name());
        if (request.activeRanks() != null && !request.activeRanks().isEmpty()) list.updateActiveRanks(request.activeRanks());
        if (request.description() != null) list.updateDescription(request.description());
        return toSummary(tierListRepository.save(list));
    }

    @Operation(summary = "Supprimer une Tier List personnalisée (et son contenu)")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        tierListItemRepository.deleteByTierListId(id);
        tierListRepository.deleteById(id);
    }

    @Operation(summary = "Ajouter des œuvres à une Tier List (non classées au départ)")
    @PostMapping("/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public TierListDetailResponse addItems(@PathVariable UUID id, @RequestBody AddTierListItemsRequest request) {
        requireTierList(id);
        // Sans cette garde, un corps sans entityIds remontait une
        // NullPointerException en 500 sur le for ci-dessous ("Cannot invoke
        // java.util.List.iterator()") - voir Lot 28.
        if (request.entityIds() == null || request.entityIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucune œuvre à ajouter");
        }
        for (UUID entityId : request.entityIds()) {
            // Déjà présente : passée sous silence, c'est une idempotence voulue
            // (rajouter une œuvre déjà là n'est pas une erreur de l'appelant).
            if (tierListItemRepository.findByTierListIdAndEntityId(id, entityId).isPresent()) continue;
            // Inconnue : refusée, jamais ignorée. Un ifPresent() renvoyait un 201
            // avec une liste inchangée - l'appelant croyait avoir ajouté une œuvre
            // qui n'existe pas (Lot 28).
            entityRepository.findById(entityId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Entité introuvable : " + entityId));
            tierListItemRepository.save(TierListItem.add(id, entityId));
        }
        return detail(id);
    }

    @Operation(summary = "Classer (ou déclasser si rank=null) une œuvre déjà ajoutée à cette Tier List")
    @PutMapping("/{id}/items/{entityId}")
    public TierListEntryResponse setItemRank(@PathVariable UUID id, @PathVariable UUID entityId, @RequestBody SetRankRequest request) {
        TierListItem item = tierListItemRepository.findByTierListIdAndEntityId(id, entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cette œuvre n'appartient pas à cette Tier List"));
        item.setRank(request.rank());
        tierListItemRepository.save(item);
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entité introuvable : " + entityId));
        return TierListEntryResponse.from(entity, request.rank());
    }

    @Operation(summary = "Retirer une œuvre d'une Tier List personnalisée")
    @DeleteMapping("/{id}/items/{entityId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeItem(@PathVariable UUID id, @PathVariable UUID entityId) {
        tierListItemRepository.deleteByTierListIdAndEntityId(id, entityId);
    }

    private TierList requireTierList(UUID id) {
        return tierListRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tier List introuvable : " + id));
    }

    private TierListResponse toSummary(TierList list) {
        List<TierListItem> items = tierListItemRepository.findByTierListId(list.id());
        int ranked = (int) items.stream().filter(i -> i.rank().isPresent()).count();
        return TierListResponse.from(list, items.size(), ranked);
    }
}
