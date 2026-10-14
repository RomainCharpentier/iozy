package com.iozycore.core.api.listing;

import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingSnapshot;
import com.iozycore.core.listing.ListingSourceResolver;
import com.iozycore.core.listing.ListingPlatform;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Reads an online listing to pre-fill a purchase analysis draft.
 *
 * <h2>This is not an arbitrary URL fetch endpoint</h2>
 * The server only fetches what a declared provider recognizes, and
 * only on the hosts that this provider explicitly allows. Any
 * other URL is never followed: it returns {@code UNSUPPORTED_SOURCE} without the
 * slightest network call. See {@code ListingUrlGuard} for the detail of the
 * protections (HTTPS only, allow list, refusal of internal addresses,
 * redirects revalidated one by one, time and size capped).
 *
 * <h2>Always 200</h2>
 * A deleted listing, an uncovered platform or a partial result are
 * not API errors: they are normal outcomes of the path, which the
 * form must know how to present without getting stuck. The {@code status} of the
 * response tells them apart, rather than an HTTP code that would mix them all up in
 * a red banner.
 */
@RestController
@RequestMapping("/api/listing-metadata")
@Tag(name = "Listing metadata", description = "Pre-filling of a purchase analysis from the link of a listing")
@RequiredArgsConstructor
public class ListingMetadataController {

    private final ListingSourceResolver resolver;

    public record ResolveListingRequest(String url) {
    }

    /**
     * @param retrievedFields what was REALLY read - the client only pre-fills these fields,
     *                        and never invents the others
     */
    public record ListingPreviewResponse(String status, ListingPlatform source, String url, String externalId,
                                          String title, String description, BigDecimal price, String currency,
                                          BigDecimal shippingFee, String shippingKind,
                                          BigDecimal buyerProtectionFee,
                                          List<String> imageUrls, Instant retrievedAt,
                                          List<String> retrievedFields) {

        static ListingPreviewResponse from(ListingResolution resolution) {
            ListingSnapshot snapshot = resolution.snapshot();
            if (snapshot == null) {
                return new ListingPreviewResponse(resolution.status().name(), resolution.source(), resolution.url(),
                        null, null, null, null, null, null, null, null, List.of(), null, List.of());
            }
            return new ListingPreviewResponse(
                    resolution.status().name(), snapshot.source(), snapshot.sourceUrl(), snapshot.externalId(),
                    snapshot.title(), snapshot.description(), snapshot.price(), snapshot.currency(),
                    snapshot.shippingFee(), snapshot.shippingKind().name(), snapshot.buyerProtectionFee(),
                    snapshot.imageUrls(), snapshot.retrievedAt(),
                    snapshot.retrievedFields().stream().map(Enum::name).toList());
        }
    }

    @Operation(summary = "Read a listing from its link to pre-fill a purchase analysis. "
            + "Always answers 200: the status field tells apart success, partial result, unsupported "
            + "source, listing not found and unavailability, each having its own follow-up on the form side.")
    @PostMapping("/resolve")
    public ListingPreviewResponse resolve(@RequestBody ResolveListingRequest request) {
        return ListingPreviewResponse.from(resolver.resolve(request.url()));
    }
}
