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
import com.iozycore.core.application.insights.StatsService;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.insights.CollectionValue;
import com.iozycore.core.domain.share.GiftLink;
import com.iozycore.core.domain.share.GiftLinkRepository;
import com.iozycore.core.domain.share.PinnedWorksRepository;
import com.iozycore.core.domain.share.ValueDisclosure;
import com.iozycore.core.domain.work.WorkView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
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
 *
 * <h2>Two kinds of link (lot 217)</h2>
 * The share link ({@link ShareSettings}) shows the sections the owner chose and
 * never expires. The gift link ({@link GiftLink}) shows the wishes only, and
 * answers {@link ShareLinkExpiredException} once its thirty days are over. Both
 * are read through {@link #read(String)}, so one public address serves both.
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
    private final PinnedWorksRepository pinnedWorksRepository;
    private final GiftLinkRepository giftLinkRepository;
    private final WorkReadModel workReadModel;
    private final StatsService statsService;

    /**
     * Empty when the link does not exist or was deleted.
     *
     * @throws ShareLinkExpiredException a gift link whose thirty days are over
     */
    public Optional<SharedSpace> read(String token) {
        Optional<SharedSpace> space = shareSettingsRepository.findByToken(token).map(this::readFor);
        if (space.isPresent()) {
            return space;
        }
        return giftLinkRepository.findByToken(token).map(this::readGift);
    }

    /**
     * The page as visitors see it, from the owner's current choices (the
     * "Partager" page). Without a link yet, it shows what a new link would show
     * with these choices. Owner side: read as the current account.
     */
    public SharedSpace preview() {
        ShareSettings settings = shareSettingsRepository.find();
        return space(settings.shareCollection(), settings.shareWishlist(),
                settings.shareCollection() && settings.includeTierLists(),
                settings.shareCollection() && settings.showValue());
    }

    /** What the gift link shows, for the owner's preview: the wishes only. */
    public SharedSpace giftPreview() {
        Instant expiresAt = giftLinkRepository.find().map(GiftLink::expiresAt).orElse(null);
        return new SharedSpace(null, sharedWishlist(), null, null, null, true, expiresAt);
    }

    /** The value of the current owner's collection, or empty when too few prices back it (the shared image). */
    public Optional<SharedSpace.SharedValue> soundValue() {
        return Optional.ofNullable(soundValueOf(statsService.computeCollectionValue()));
    }

    private SharedSpace readFor(ShareSettings settings) {
        // The recipient of a link has no account: the isolation cannot come
        // from the session. It comes from the TOKEN, which names its owner.
        return readOnBehalfOf.run(settings.ownerId(), () -> space(settings.sharesCollection(),
                settings.sharesWishlist(), settings.sharesTierLists(), settings.sharesValue()));
    }

    /** The wishes, and nothing else: no collection, no pins, no ranking, no value. */
    private SharedSpace readGift(GiftLink link) {
        if (link.isExpiredAt(Instant.now())) {
            throw new ShareLinkExpiredException();
        }
        return readOnBehalfOf.run(link.ownerId(),
                () -> new SharedSpace(null, sharedWishlist(), null, null, null, true, link.expiresAt()));
    }

    private SharedSpace space(boolean collection, boolean wishlist, boolean tierLists, boolean value) {
        return new SharedSpace(
                collection ? sharedCollection() : null,
                wishlist ? sharedWishlist() : null,
                tierLists ? sharedTierLists() : null,
                collection ? pinnedWorks() : null,
                value ? soundValueOf(statsService.computeCollectionValue()) : null,
                false, null);
    }

    /**
     * The value, only when it rests on enough prices. Below the threshold the
     * answer is null, not a smaller number: a visitor cannot see the caveat.
     */
    static SharedSpace.SharedValue soundValueOf(CollectionValue value) {
        if (value == null || value.totalKnownValue() == null
                || !ValueDisclosure.isSound(value.pricedOwnershipCount(), value.totalActiveOwnershipCount())) {
            return null;
        }
        return new SharedSpace.SharedValue(value.totalKnownValue(), value.pricedOwnershipCount(),
                value.totalActiveOwnershipCount());
    }

    /**
     * The pinned works in the order chosen, read in one batch. A pin whose work
     * is no longer owned (sold, given away) is skipped: the page shows what is
     * owned, and a pinned wish would leak the wishes into a collection share.
     */
    private List<SharedSpace.SharedPinnedWork> pinnedWorks() {
        List<UUID> ids = pinnedWorksRepository.find().entityIds();
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, WorkView> views = workReadModel.works(new LinkedHashSet<>(ids)).stream()
                .collect(Collectors.toMap(WorkView::entityId, Function.identity(), (a, b) -> a));
        return ids.stream()
                .map(views::get)
                .filter(Objects::nonNull)
                .filter(view -> view.ownedCount() > 0)
                .map(view -> new SharedSpace.SharedPinnedWork(view.title(), view.coverImageUrl(),
                        view.ownedCount(), view.totalCount()))
                .collect(Collectors.toList());
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
