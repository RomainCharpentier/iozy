package com.iozycore.core.api.share;

import com.iozycore.core.api.dto.ShareDtos.GiftLinkResponse;
import com.iozycore.core.api.dto.ShareDtos.PinnedWorksRequest;
import com.iozycore.core.api.dto.ShareDtos.ShareResponse;
import com.iozycore.core.api.dto.ShareDtos.UpdateShareRequest;
import com.iozycore.core.application.share.ShareService;
import com.iozycore.core.application.share.SharedSpace;
import com.iozycore.core.application.share.SharedSpaceQuery;
import com.iozycore.core.domain.share.GiftLink;
import com.iozycore.core.domain.share.ShareSettings;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

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
 * <p>
 * Lot 217 adds the "Partager" page: the preview, the pinned works, the value
 * switch and the gift list link (wishes only, thirty days).
 */
@RestController
@RequestMapping("/api/share")
@Tag(name = "Sharing", description = "One link, visible sections of your choice (collection, wishes)")
@RequiredArgsConstructor
public class ShareController {

    private final ShareService shareService;
    private final SharedSpaceQuery sharedSpaceQuery;

    @Operation(summary = "Current state of the sharing (token null = no active link)")
    @GetMapping
    public ShareResponse current() {
        return toResponse(shareService.current());
    }

    @Operation(summary = "Generate (or regenerate) the link. Regenerating immediately invalidates the old token, and "
            + "starts again from the most closed choices: both sections visible, Tier Lists and value excluded.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ShareResponse generate() {
        return toResponse(shareService.generate());
    }

    @Operation(summary = "Change the visible sections WITHOUT touching the link already handed out. Absent field (null) "
            + "= unchanged. Refuses to uncheck everything: a link that exposes nothing must be deleted, not emptied.")
    @PatchMapping
    public ShareResponse update(@RequestBody UpdateShareRequest request) {
        return toResponse(shareService.changeSections(
                request.shareCollection(), request.shareWishlist(), request.includeTierLists(), request.showValue()));
    }

    @Operation(summary = "Delete the link - the previous token stops working immediately. The gift link stays.")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove() {
        shareService.remove();
    }

    @Operation(summary = "The public page as visitors see it, from the current choices (also before any link exists)")
    @GetMapping("/preview")
    public SharedSpace preview() {
        return sharedSpaceQuery.preview();
    }

    @Operation(summary = "The gift list page as visitors see it: the wishes only")
    @GetMapping("/gift/preview")
    public SharedSpace giftPreview() {
        return sharedSpaceQuery.giftPreview();
    }

    @Operation(summary = "The value of the collection when enough prices back it (>= 5 priced objects and >= 50% "
            + "of them), for the shared image. 204 when it does not: no number is better than a wrong one.")
    @GetMapping("/value")
    public ResponseEntity<SharedSpace.SharedValue> value() {
        return sharedSpaceQuery.soundValue()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @Operation(summary = "Replace \"Mes 4 incontournables\", in order. At most four, each owned today (400 otherwise)")
    @PutMapping("/pins")
    public ShareResponse pin(@RequestBody PinnedWorksRequest request) {
        shareService.pin(request == null ? null : request.entityIds());
        return current();
    }

    @Operation(summary = "Create the gift list link, or renew it: valid 30 days from now, same token when it exists")
    @PostMapping("/gift")
    public ShareResponse issueOrRenewGift() {
        shareService.issueOrRenewGiftLink();
        return current();
    }

    @Operation(summary = "Delete the gift list link - it stops answering at once")
    @DeleteMapping("/gift")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeGift() {
        shareService.removeGiftLink();
    }

    private ShareResponse toResponse(ShareSettings settings) {
        Instant now = Instant.now();
        GiftLinkResponse gift = shareService.giftLink()
                .map(link -> toGift(link, now))
                .orElse(null);
        return new ShareResponse(settings.token(), settings.shareCollection(), settings.shareWishlist(),
                settings.includeTierLists(), settings.showValue(), shareService.pinned().entityIds(), gift);
    }

    private static GiftLinkResponse toGift(GiftLink link, Instant now) {
        return new GiftLinkResponse(link.token(), link.expiresAt(), link.isExpiredAt(now));
    }
}
