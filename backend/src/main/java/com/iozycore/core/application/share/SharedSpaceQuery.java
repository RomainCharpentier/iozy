package com.iozycore.core.application.share;

import com.iozycore.core.application.TierListService;
import com.iozycore.core.application.share.SharedSpace.*;
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
import com.iozycore.core.domain.insights.CollectionProgress;
import com.iozycore.core.application.insights.SeriesProgressGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Reads the shared space behind a token: the only use case designed for
 * someone other than the owner.
 *
 * <h2>The token acts as a password</h2>
 * Having it is enough. An unknown, revoked, empty or absent token gives an
 * empty result, never a detail that would let someone guess it once existed.
 *
 * <h2>The filtering is here, not in the client</h2>
 * The sections that are not shared are <b>not computed</b>, and the result
 * carries {@code null} in their place. A visitor who inspects the network does
 * not find a hidden collection in a wishes share.
 *
 * <h2>Live view, not a photograph</h2>
 * Each call reads the collection and the wishes again as they are now. The
 * collection only shows what is REALLY owned (active Ownership); the wishes show
 * the wished works, <b>including those that are not owned</b>.
 */
@Service
@RequiredArgsConstructor
public class SharedSpaceQuery {

    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private final ShareSettingsRepository shareSettingsRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final TierListRepository tierListRepository;
    private final TierListService tierListService;
    private final SeriesProgressGateway progressService;
    private final ReadOnBehalfOf readOnBehalfOf;

    /** Empty when the link does not exist or was deleted. */
    public Optional<SharedSpace> read(String token) {
        return shareSettingsRepository.findByToken(token).map(this::readFor);
    }

    private SharedSpace readFor(ShareSettings settings) {
        // The recipient of a link has no account: the isolation cannot come
        // from the session. It comes from the TOKEN, which names its owner.
        return readOnBehalfOf.run(settings.ownerId(), () -> new SharedSpace(
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
     * The wishes. No ownership is required or consulted: a wished work most
     * often has no copy. A work both owned and wished appears in both sections -
     * these are two different intentions, not a duplicate.
     */
    private List<SharedWishlistItem> sharedWishlist() {
        // The works are loaded IN ONE GO (one query per universe), not one query
        // per wish: this path is not authenticated and anyone holding the link
        // can call it again as many times as they want.
        Map<UUID, Entity> worksById = allWorks();
        return wishlistEntryRepository.findAll().stream()
                .map(entry -> toWishlistItem(entry, worksById.get(entry.entityId())))
                .flatMap(Optional::stream)
                .sorted(Comparator.comparing(SharedWishlistItem::title, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    private Map<UUID, Entity> allWorks() {
        Map<UUID, Entity> byId = new LinkedHashMap<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            for (Entity entity : entityRepository.findAllByType(type.id())) {
                byId.put(entity.id(), entity);
            }
        }
        return byId;
    }

    /** Empty if the referenced work has disappeared: an orphan entry must not break the public view. */
    private static Optional<SharedWishlistItem> toWishlistItem(WishlistEntry entry, Entity entity) {
        return Optional.ofNullable(entity)
                .map(work -> new SharedWishlistItem(work.title(), coverOf(work), entry.addedAt()));
    }

    private static SharedCollectionItem toItem(Entity entity, CollectionProgress progress) {
        List<String> editions = progress.editions().stream()
                .filter(e -> !e.editionName().isEmpty() && e.ownedCount() > 0)
                .map(CollectionProgress.EditionProgress::editionName)
                .sorted()
                .collect(Collectors.toList());

        // The total only makes sense attached to ONE edition: when several are
        // really collected, the progress stays without a total rather than
        // picking one at random (see dominantEdition).
        Integer totalVolumes = progress.dominantEdition() == null ? null : progress.dominantEdition().totalVolumes();

        return new SharedCollectionItem(entity.title(), coverOf(entity), editions,
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
                            .map(SharedSpaceQuery::toRankedItem)
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
                // Only what is really RANKED: a work added to the list but
                // not yet ranked is not an opinion.
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
        return new SharedRankedItem(entity.title(), coverOf(entity));
    }

    private static String coverOf(Entity entity) {
        return entity.attributes().get(COVER_IMAGE_URL) instanceof String url ? url : null;
    }
}
