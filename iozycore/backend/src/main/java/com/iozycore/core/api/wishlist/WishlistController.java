package com.iozycore.core.api.wishlist;

import com.iozycore.core.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.core.api.dto.WishlistDtos.LookupResponse;
import com.iozycore.core.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.core.application.WishlistService;
import com.iozycore.core.application.WishlistService.AddToWishlist;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/wishlist")
@Tag(name = "Wishlist", description = "UC5 - wishlist, and UC4 - check before purchase")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    @Operation(summary = "Add to the wishes the item really wanted: a volume (variantId, or volumeNumber "
            + "+ edition) when the type has them, the whole work otherwise. The work is designated by its entityId or, "
            + "if it has no page yet, by entityTypeId + title. Never creates an ownership.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WishlistEntryResponse add(@RequestBody AddToWishlistRequest request) {
        AddToWishlist command = new AddToWishlist(request.entityId(), request.variantId(),
                request.volumeNumber(), request.edition(), request.entityTypeId(), request.title(),
                request.attributes());
        return WishlistEntryResponse.from(wishlistService.add(command));
    }

    @Operation(summary = "List all entries of the wishlist (Wishlist tab)")
    @GetMapping
    public List<WishlistEntryResponse> listAll() {
        return wishlistService.listAll().stream().map(WishlistEntryResponse::from).toList();
    }

    @Operation(summary = "Remove an entry from the wishlist - only targets WishlistEntry, "
            + "never the Series/Edition/Volume nor an Ownership. Idempotent: an id already removed does not return an error.")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        wishlistService.remove(id);
    }

    @Operation(summary = "Path 3: check in one call whether an Entity is owned, in the wishlist, or unknown")
    @GetMapping("/lookup")
    public LookupResponse lookup(@RequestParam UUID entityId) {
        return new LookupResponse(wishlistService.lookup(entityId).name());
    }
}
