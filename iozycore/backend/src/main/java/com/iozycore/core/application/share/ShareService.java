package com.iozycore.core.application.share;

import com.iozycore.core.application.auth.UtilisateurCourant;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.share.GiftLink;
import com.iozycore.core.domain.share.GiftLinkRepository;
import com.iozycore.core.domain.share.PinnedWorks;
import com.iozycore.core.domain.share.PinnedWorksRepository;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import com.iozycore.core.domain.work.WorkView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Use cases of the share link, on the owner side. The visitor side is {@link SharedSpaceQuery}. */
@Service
@RequiredArgsConstructor
public class ShareService {

    private final ShareSettingsRepository repository;
    private final UtilisateurCourant utilisateurCourant;
    private final PinnedWorksRepository pinnedWorksRepository;
    private final GiftLinkRepository giftLinkRepository;
    private final WorkReadModel workReadModel;

    public ShareSettings current() {
        return repository.find();
    }

    /**
     * Generates (or regenerates) the link. Regenerating invalidates the old token
     * at once, and starts again from the most closed choices.
     */
    @Transactional
    public ShareSettings generate() {
        return repository.save(ShareSettings.withNewToken(utilisateurCourant.proprietaire()));
    }

    /**
     * Changes the visible sections without touching the link already handed out.
     * A null field is left unchanged. The domain refuses to uncheck everything
     * (400): a link that exposes nothing must be deleted, not emptied.
     */
    @Transactional
    public ShareSettings changeSections(Boolean shareCollection, Boolean shareWishlist, Boolean includeTierLists) {
        return changeSections(shareCollection, shareWishlist, includeTierLists, null);
    }

    /** Same, with the value of the collection (lot 217). */
    @Transactional
    public ShareSettings changeSections(Boolean shareCollection, Boolean shareWishlist, Boolean includeTierLists,
                                        Boolean showValue) {
        ShareSettings settings = repository.find();
        ShareSettings changed = settings
                .withSections(
                        shareCollection == null ? settings.shareCollection() : shareCollection,
                        shareWishlist == null ? settings.shareWishlist() : shareWishlist)
                .withTierLists(includeTierLists == null ? settings.includeTierLists() : includeTierLists)
                .withShowValue(showValue == null ? settings.showValue() : showValue);
        return repository.save(changed);
    }

    /** Deletes the link: the previous token stops working at once. The gift link is a separate one. */
    @Transactional
    public void remove() {
        repository.save(ShareSettings.noLink(utilisateurCourant.proprietaire()));
    }

    // ------------------------------------------------------------ Pinned works

    /**
     * The pins whose work is still owned, in order. A work sold or given away
     * after it was pinned stays in the table but is left out here, as on the
     * public page: the owner cannot see it, so it must not count in the four.
     */
    public PinnedWorks pinned() {
        List<UUID> ids = pinnedWorksRepository.find().entityIds();
        if (ids.isEmpty()) {
            return new PinnedWorks(List.of());
        }
        Set<UUID> owned = ownedAmong(ids);
        return new PinnedWorks(ids.stream().filter(owned::contains).toList());
    }

    private Set<UUID> ownedAmong(List<UUID> ids) {
        return workReadModel.works(new LinkedHashSet<>(ids)).stream()
                .filter(view -> view.ownedCount() > 0)
                .map(WorkView::entityId)
                .collect(Collectors.toSet());
    }

    /**
     * Replaces "Mes 4 incontournables". Each work must be owned by this account
     * today: the public page shows a collection, and pinning a wish would put it
     * in front of visitors of a collection-only link. A work of another account
     * is not owned by this one, so it is refused the same way.
     * <p>
     * A work that was already pinned and is no longer owned is dropped without
     * an error: the owner cannot see it any more, so a client that still sends
     * it must not be blocked from every change.
     *
     * @throws IllegalArgumentException more than four, a duplicate, or a new work not owned
     */
    @Transactional
    public PinnedWorks pin(List<UUID> entityIds) {
        List<UUID> asked = entityIds == null ? List.of() : entityIds;
        if (asked.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("Une œuvre épinglée doit être désignée");
        }
        List<UUID> kept = asked;
        if (!asked.isEmpty()) {
            Set<UUID> owned = ownedAmong(asked);
            Set<UUID> before = Set.copyOf(pinnedWorksRepository.find().entityIds());
            boolean newOneNotOwned = asked.stream()
                    .anyMatch(id -> !owned.contains(id) && !before.contains(id));
            if (newOneNotOwned) {
                throw new IllegalArgumentException("Un incontournable doit faire partie de ta collection");
            }
            // Old pins no longer owned leave before the count of four is checked.
            kept = asked.stream().filter(owned::contains).toList();
        }
        pinnedWorksRepository.replace(new PinnedWorks(kept));
        return pinned();
    }

    // --------------------------------------------------------------- Gift list

    public Optional<GiftLink> giftLink() {
        return giftLinkRepository.find();
    }

    /**
     * The gift link, valid for thirty days from now: created when there is none,
     * renewed (same token) when there is one, expired or not. A list already
     * sent keeps working.
     */
    @Transactional
    public GiftLink issueOrRenewGiftLink() {
        Instant now = Instant.now();
        return giftLinkRepository.save(giftLinkRepository.find()
                .map(link -> link.renewed(now))
                .orElseGet(() -> GiftLink.issue(utilisateurCourant.proprietaire(), now)));
    }

    /** Removes the gift link: it stops answering, and the next one gets a new token. */
    @Transactional
    public void removeGiftLink() {
        giftLinkRepository.delete();
    }
}
