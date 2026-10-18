package com.iozycore.core.api.ownership;

import com.iozycore.core.api.dto.OwnershipDtos.OwnershipResponse;
import com.iozycore.core.application.OwnershipDeletionService;
import com.iozycore.core.application.OwnershipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ownerships")
@Tag(name = "Ownerships", description = "UC2 - management of ownerships, independent of Experiences")
@RequiredArgsConstructor
public class OwnershipController {

    private final OwnershipService ownershipService;
    private final OwnershipDeletionService ownershipDeletionService;

    @Operation(summary = "List the Ownerships - filtered on an Entity if entityId is given, all otherwise "
            + "(e.g. progress computation per series on My collection, which needs the real ownership of "
            + "each displayed series in one go rather than one query per series)")
    @GetMapping
    public List<OwnershipResponse> list(@RequestParam(required = false) UUID entityId) {
        return ownershipService.list(entityId).stream()
                .map(OwnershipResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Mark an Ownership as sold")
    @PostMapping("/{id}/sell")
    public OwnershipResponse markSold(@PathVariable UUID id) {
        return OwnershipResponse.from(ownershipService.markSold(id));
    }

    @Operation(summary = "Mark an Ownership as lost")
    @PostMapping("/{id}/lose")
    public OwnershipResponse markLost(@PathVariable UUID id) {
        return OwnershipResponse.from(ownershipService.markLost(id));
    }

    @Operation(summary = "Put a sold or lost copy back in ownership - serves the \"Undo\" action "
            + "offered right after marking sold/lost. 409 if the copy is already active.")
    // No web caller today, and yet kept: the iOS client
    // knows how to mark sold and lost (/sell, /lose). Without this route, these two
    // actions would be one-way. It is a missing screen, not
    // dead code - same distinction as in Batch 51 for the purchase
    // analysis preferences.
    @PostMapping("/{id}/restore")
    public OwnershipResponse restore(@PathVariable UUID id) {
        return OwnershipResponse.from(ownershipService.restore(id));
    }

    @Operation(summary = "Permanently delete a copy - unlike \"mark sold/lost\" "
            + "(reversible status change), this action is irreversible. The cataloged Volume that it "
            + "references is never deleted: only the ownership disappears.")
    @ApiResponse(responseCode = "204", description = "Copy deleted - no body. Idempotent: "
            + "an id already deleted or unknown also returns 204.")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        ownershipDeletionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
