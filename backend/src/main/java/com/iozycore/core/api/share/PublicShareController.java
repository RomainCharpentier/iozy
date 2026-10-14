package com.iozycore.core.api.share;

import com.iozycore.core.infrastructure.multitenance.AuNomDe;
import com.iozycore.core.api.dto.ShareDtos.*;
import com.iozycore.core.application.TierListService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListItem;
import com.iozycore.core.domain.tierlist.TierListRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.insights.CollectionProgress;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;
import com.iozycore.core.insights.SeriesProgressGateway;

/**
 * The ONLY controller of the application designed to be opened by someone
 * other than the owner. There used to be two - one per section - and this is
 * precisely what this unification removed.
 *
 * <h2>The token acts as a password</h2>
 * Having it is enough, there is nothing else to present: this controller
 * asks for no authentication, and this is wanted - the person who receives the
 * link has no account. An unknown, revoked, empty or absent token gives a
 * <b>bare 404</b>, never a detail that would let someone guess it once existed.
 *
 * <h2>The filtering is here, not in the client</h2>
 * The sections that are not shared are not hidden at display time: they
 * are <b>not computed</b>, and the response carries {@code null} in their place. A
 * visitor who inspects the network does not find a hidden collection in a
 * wishes share.
 *
 * <p>{@code null} and not an empty list, and the nuance carries information:
 * {@code []} would say "shared, but there is nothing in it", which is a fact
 * about the person; {@code null} only says "you do not have access to it". This
 * sentence used to claim that the key did not appear at all in the
 * response - that was false, the wire does carry {@code "tierLists":null}, and the
 * test that seemed to check it used {@code doesNotExist()}, true for
 * both forms at once. And nothing ever comes out of the works beyond the title, the cover,
 * the owned editions and the progress - see {@code ShareDtos} for the
 * list of what is deliberately absent.
 *
 * <h2>Live view, not a photograph</h2>
 * Each call reads the collection and the wishes again as they are
 * now: adding a volume makes it appear in the link already handed out,
 * with nothing to regenerate. The collection only shows what is REALLY
 * owned (active Ownership); the wishes show the wished works, <b>including
 * those that are not owned</b> - this is even the normal case.
 */
@RestController
@RequestMapping("/api/public/share")
@Tag(name = "Shared space", description = "Read only, unauthenticated, reserved for the holder of the link")
@RequiredArgsConstructor
public class PublicShareController {

    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private final ShareSettingsRepository shareSettingsRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final TierListRepository tierListRepository;
    private final TierListService tierListService;
    private final SeriesProgressGateway progressService;

    @Operation(summary = "Read-only shared space through a token. 404 if the link does not exist or was "
            + "deleted. A section that is not shared is null in the response, never an empty list: "
            + "[] would say \"shared but nothing in it\", null says \"no access\".")
    @GetMapping("/{token}")
    public SharedSpaceResponse shared(@PathVariable String token) {
        ShareSettings settings = shareSettingsRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lien introuvable"));

        // The recipient of a link has no account: the partitioning cannot
        // come from the session. It comes from the TOKEN, which names its
        // owner - and this is written here, where the reading on behalf of
        // someone else happens, rather than deduced from where one comes from.
        return AuNomDe.executer(settings.ownerId(), () -> new SharedSpaceResponse(
                settings.sharesCollection() ? sharedCollection() : null,
                settings.sharesWishlist() ? sharedWishlist() : null,
                settings.sharesTierLists() ? sharedTierLists() : null));
    }

    /** What is really owned, grouped by universe - never the plain catalog. */
    private List<SharedUniverse> sharedCollection() {
        Map<UUID, CollectionProgress> progressByEntity = progressService.computeAll().stream()
                .collect(Collectors.toMap(CollectionProgress::entityId, p -> p));
        Set<UUID> owned = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .map(Ownership::entityId)
                .collect(Collectors.toSet());

        List<SharedUniverse> universes = new ArrayList<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            List<SharedCollectionItem> items = entityRepository.findAllByType(type.id()).stream()
                    .filter(entity -> owned.contains(entity.id()))
                    .map(entity -> toItem(entity, progressByEntity.get(entity.id())))
                    .sorted(Comparator.comparing(SharedCollectionItem::title, String.CASE_INSENSITIVE_ORDER))
                    .collect(Collectors.toList());
            // Universe with nothing owned: absent, never an empty section
            // (same rule as My collection on the owner side).
            if (!items.isEmpty()) {
                universes.add(new SharedUniverse(type.label(), items));
            }
        }
        return universes;
    }

    /**
     * The wishes. No ownership is required or consulted: a wished
     * work most often has no copy, this is the whole point of
     * sharing it. A work that is both owned and wished appears in both
     * sections - these are two different intentions, not a duplicate.
     */
    private List<SharedWishlistItem> sharedWishlist() {
        // The works loaded IN ONE GO, not one query per wish.
        //
        // Each entry triggered its own findById: a wishlist of
        // fifty rows cost fifty queries, on the only surface
        // open to the outside - and on a path that anyone holding
        // the link can call again as many times as they want. Same reasoning
        // as in Batch 35 for the volume search, with the added fact that
        // this one is not authenticated.
        //
        // Three queries are enough (one per universe), and sharedCollection
        // already goes through the types the same way.
        Map<UUID, Entity> oeuvresParId = toutesLesOeuvres();
        return wishlistEntryRepository.findAll().stream()
                .map(entry -> toWishlistItem(entry, oeuvresParId.get(entry.entityId())))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .sorted(Comparator.comparing(SharedWishlistItem::title, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    private Map<UUID, Entity> toutesLesOeuvres() {
        Map<UUID, Entity> parId = new LinkedHashMap<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            for (Entity entity : entityRepository.findAllByType(type.id())) {
                parId.put(entity.id(), entity);
            }
        }
        return parId;
    }

    /** Empty if the referenced work has disappeared: an orphan entry must not break the public view. */
    private Optional<SharedWishlistItem> toWishlistItem(WishlistEntry entry, Entity entity) {
        return Optional.ofNullable(entity).map(oeuvre -> {
            Object cover = oeuvre.attributes().get(COVER_IMAGE_URL);
            return new SharedWishlistItem(oeuvre.title(), cover instanceof String url ? url : null, entry.addedAt());
        });
    }

    private SharedCollectionItem toItem(Entity entity, CollectionProgress progress) {
        List<String> editions = progress.editions().stream()
                .filter(e -> !e.editionName().isEmpty() && e.ownedCount() > 0)
                .map(CollectionProgress.EditionProgress::editionName)
                .sorted()
                .collect(Collectors.toList());

        // The total only makes sense attached to ONE edition: when several are
        // really collected, the progress stays without a total rather than
        // picking one at random (see dominantEdition).
        Integer totalVolumes = progress.dominantEdition() == null ? null : progress.dominantEdition().totalVolumes();

        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return new SharedCollectionItem(entity.title(), cover instanceof String url ? url : null, editions,
                progress.ownedVolumeCount(), totalVolumes);
    }

    private SharedTierLists sharedTierLists() {
        List<SharedTierBoard> general = new ArrayList<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            TierListService.GeneralBoard board = tierListService.generalBoard(type.id());
            List<SharedTierRow> rows = board.ranked().entrySet().stream()
                    .filter(e -> !e.getValue().isEmpty())
                    .sorted(Map.Entry.comparingByKey())
                    .map(e -> new SharedTierRow(e.getKey().name(), e.getValue().stream()
                            .map(PublicShareController::toRankedItem)
                            .collect(Collectors.toList())))
                    .collect(Collectors.toList());
            // A universe with NO ranked work does not appear: "nothing
            // ranked" is not a ranking to show.
            if (!rows.isEmpty()) {
                general.add(new SharedTierBoard(type.label(), rows));
            }
        }

        List<SharedTierBoard> custom = new ArrayList<>();
        List<TierList> lists = new ArrayList<>(tierListRepository.findAllUniversesLists());
        for (EntityType type : entityTypeRepository.findAll()) {
            lists.addAll(tierListRepository.findByEntityTypeId(type.id()));
        }
        for (TierList list : lists) {
            Map<Rank, List<SharedRankedItem>> byRank = new EnumMap<>(Rank.class);
            for (Map.Entry<TierListItem, Entity> entry : tierListService.enrichedItems(list.id())) {
                // Only what is really RANKED: a work added to
                // the list but not yet ranked is not an opinion.
                entry.getKey().rank().ifPresent(rank -> byRank
                        .computeIfAbsent(rank, r -> new ArrayList<>())
                        .add(toRankedItem(entry.getValue())));
            }
            if (byRank.isEmpty()) {
                continue;
            }
            List<SharedTierRow> rows = byRank.entrySet().stream()
                    .map(e -> new SharedTierRow(e.getKey().name(), e.getValue()))
                    .collect(Collectors.toList());
            custom.add(new SharedTierBoard(list.name(), rows));
        }

        return new SharedTierLists(general, custom);
    }

    private static SharedRankedItem toRankedItem(Entity entity) {
        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return new SharedRankedItem(entity.title(), cover instanceof String url ? url : null);
    }
}
