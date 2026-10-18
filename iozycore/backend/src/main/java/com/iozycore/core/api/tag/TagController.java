package com.iozycore.core.api.tag;

import com.iozycore.core.application.TagService;
import com.iozycore.core.domain.catalog.Tag;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Tags: free labels put on a WORK, never on a volume nor
 * on a copy.
 *
 * <h2>Shared, and administered (2026-08-30)</h2>
 * A tag describes the work itself - "seinen", "one-shot", "adapted into an
 * anime" - just like its category or its reference edition. It lives
 * therefore in the <b>shared</b> catalog: a work is the same for
 * everyone, and so is its label.
 * <p>
 * This is precisely why setting them is <b>administrative</b> (see
 * SecurityConfig): without this rule, any account would tag the
 * works of all the others. Everyone <b>reads</b> them - this is what makes
 * the filter of My collection usable.
 * <p>
 * What follows from this choice: a tag is not the place to note "lent to
 * Marc" or "for resale". Such things are personal, they have nothing
 * to do in a common catalog, and nothing here welcomes them.
 */
@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    public record CreateTagRequest(String label) {
    }

    public record RenommerTagRequest(String label) {
    }

    private final TagService tagService;

    @Operation(summary = "Create a Tag (reusable on several Entities)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Tag create(@RequestBody CreateTagRequest request) {
        return tagService.create(request.label());
    }

    @Operation(summary = "List all existing Tags")
    @GetMapping
    public List<Tag> listAll() {
        return tagService.listAll();
    }

    @Operation(summary = "Attach an existing Tag to an Entity")
    @PostMapping("/entities/{entityId}/{tagId}")
    public void attachToEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        tagService.attach(entityId, tagId);
    }

    @Operation(summary = "Rename a Tag - reserved for administrators")
    @PatchMapping("/{tagId}")
    public Tag renommer(@PathVariable UUID tagId, @RequestBody RenommerTagRequest request) {
        return tagService.rename(tagId, request.label());
    }

    @Operation(summary = "Delete a Tag and remove it from all works - reserved for administrators")
    @DeleteMapping("/{tagId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable UUID tagId) {
        tagService.delete(tagId);
    }

    @Operation(summary = "Remove a Tag from an Entity")
    @DeleteMapping("/entities/{entityId}/{tagId}")
    public void detachFromEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        tagService.detach(entityId, tagId);
    }
}
