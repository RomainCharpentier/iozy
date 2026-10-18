package com.iozycore.core.application.share;

import com.iozycore.core.application.auth.UtilisateurCourant;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Use cases of the share link, on the owner side. The visitor side is {@link SharedSpaceQuery}. */
@Service
@RequiredArgsConstructor
public class ShareService {

    private final ShareSettingsRepository repository;
    private final UtilisateurCourant utilisateurCourant;

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
        ShareSettings settings = repository.find();
        ShareSettings changed = settings
                .withSections(
                        shareCollection == null ? settings.shareCollection() : shareCollection,
                        shareWishlist == null ? settings.shareWishlist() : shareWishlist)
                .withTierLists(includeTierLists == null ? settings.includeTierLists() : includeTierLists);
        return repository.save(changed);
    }

    /** Deletes the link: the previous token stops working at once. */
    @Transactional
    public void remove() {
        repository.save(ShareSettings.noLink(utilisateurCourant.proprietaire()));
    }
}
