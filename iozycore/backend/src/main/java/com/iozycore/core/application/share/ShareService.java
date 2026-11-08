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

    public PinnedWorks pinned() {
        return pinnedWorksRepository.find();
    }

    /**
     * Replaces "Mes 4 incontournables". Each work must be owned by this account
     * today: the public page shows a collection, and pinning a wish would put it
     * in front of visitors of a collection-only link. A work of another account
     * is not owned by this one, so it is refused the same way.
     *
     * @throws IllegalArgumentException more than four, a duplicate, or a work not owned
     */
    @Transactional
    public PinnedWorks pin(List<UUID> entityIds) {
        PinnedWorks pinned = new PinnedWorks(entityIds == null ? List.of() : entityIds);
        if (!pinned.entityIds().isEmpty()) {
            Set<UUID> owned = workReadModel.works(new LinkedHashSet<>(pinned.entityIds())).stream()
                    .filter(view -> view.ownedCount() > 0)
                    .map(WorkView::entityId)
                    .collect(Collectors.toSet());
            if (!owned.containsAll(pinned.entityIds())) {
                throw new IllegalArgumentException("Un incontournable doit faire partie de ta collection");
            }
        }
        pinnedWorksRepository.replace(pinned);
        return pinnedWorksRepository.find();
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
