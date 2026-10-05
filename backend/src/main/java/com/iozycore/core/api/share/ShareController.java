package com.iozycore.core.api.share;

import com.iozycore.core.application.auth.UtilisateurCourant;
import com.iozycore.core.api.dto.ShareDtos.ShareResponse;
import com.iozycore.core.api.dto.ShareDtos.UpdateShareRequest;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Space sharing on the owner side: a single link, whose visible
 * sections can be chosen.
 * <p>
 * A single controller for both sections, on purpose. There used to be two -
 * {@code /collection-share} and {@code /wishlist/share} - which produced two
 * distinct tokens: entering through "My collection" or through "My wishes"
 * gave two different URLs for the same personal space. The shortcuts
 * of these two screens now call these same endpoints; there is only
 * one token, whatever the entry door.
 */
@RestController
@RequestMapping("/api/share")
@Tag(name = "Sharing", description = "One link, visible sections of your choice (collection, wishes)")
public class ShareController {

    private final ShareSettingsRepository repository;
    private final UtilisateurCourant utilisateurCourant;

    public ShareController(ShareSettingsRepository repository, UtilisateurCourant utilisateurCourant) {
        this.repository = repository;
        this.utilisateurCourant = utilisateurCourant;
    }

    @Operation(summary = "Current state of the sharing (token null = no active link)")
    @GetMapping
    public ShareResponse current() {
        return toResponse(repository.find());
    }

    @Operation(summary = "Generate (or regenerate) the link. Regenerating immediately invalidates the old token, and "
            + "starts again from the most closed choices: both sections visible, Tier Lists excluded.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ShareResponse generate() {
        return toResponse(repository.save(ShareSettings.withNewToken(utilisateurCourant.proprietaire())));
    }

    @Operation(summary = "Change the visible sections WITHOUT touching the link already handed out. Absent field (null) "
            + "= unchanged. Refuses to uncheck everything: a link that exposes nothing must be deleted, not emptied.")
    @PatchMapping
    public ShareResponse update(@RequestBody UpdateShareRequest request) {
        ShareSettings settings = repository.find();
        try {
            // The construction is INSIDE the try: it is what refuses to uncheck
            // everything (see ShareSettings), not the save. The invariant lives
            // in the domain, we do not replay it here - we translate its refusal
            // into a readable 400 rather than letting a 500 come up.
            ShareSettings modifiees = settings
                    .withSections(
                            request.shareCollection() == null ? settings.shareCollection() : request.shareCollection(),
                            request.shareWishlist() == null ? settings.shareWishlist() : request.shareWishlist())
                    .withTierLists(
                            request.includeTierLists() == null
                                    ? settings.includeTierLists() : request.includeTierLists());
            return toResponse(repository.save(modifiees));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "Delete the link - the previous token stops working immediately")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove() {
        repository.save(ShareSettings.noLink(utilisateurCourant.proprietaire()));
    }

    private static ShareResponse toResponse(ShareSettings settings) {
        return new ShareResponse(settings.token(), settings.shareCollection(), settings.shareWishlist(),
                settings.includeTierLists());
    }
}
