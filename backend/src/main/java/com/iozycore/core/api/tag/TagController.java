package com.iozycore.core.api.tag;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
public class TagController {

    public record CreateTagRequest(String label) {
    }

    public record RenommerTagRequest(String label) {
    }

    private final TagRepository tagRepository;
    private final EntityRepository entityRepository;

    public TagController(TagRepository tagRepository, EntityRepository entityRepository) {
        this.tagRepository = tagRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Create a Tag (reusable on several Entities)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Tag create(@RequestBody CreateTagRequest request) {
        return tagRepository.findByLabel(request.label())
                .orElseGet(() -> tagRepository.save(new Tag(UUID.randomUUID(), request.label())));
    }

    @Operation(summary = "List all existing Tags")
    @GetMapping
    public List<Tag> listAll() {
        return tagRepository.findAll();
    }

    @Operation(summary = "Attach an existing Tag to an Entity")
    @PostMapping("/entities/{entityId}/{tagId}")
    public void attachToEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        // The Tag must exist too. Without this check, only the foreign key
        // protected the table: the client got a 409 "Cette donnée entre
        // en conflit avec une donnée existante" while the tag is ABSENT,
        // not conflicting - and the line above already returned, for the entity,
        // the 404 that this case deserves just as much.
        if (tagRepository.findById(tagId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag introuvable : " + tagId);
        }
        entity.addTag(tagId);
        entityRepository.save(entity);
    }

    @Operation(summary = "Rename a Tag - reserved for administrators")
    @PatchMapping("/{tagId}")
    public Tag renommer(@PathVariable UUID tagId, @RequestBody RenommerTagRequest request) {
        Tag existant = tagRepository.findById(tagId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag introuvable : " + tagId));
        String libelle = request.label() == null ? "" : request.label().trim();
        if (libelle.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le libellé d'un tag ne peut pas être vide.");
        }
        // A label is unique in the database: say it here rather than letting
        // a constraint violation come up, which nobody can read.
        // Renaming oneself to the identical name stays allowed - it is a
        // non-change, not a conflict.
        if (tagRepository.findByLabel(libelle).filter(autre -> !autre.id().equals(tagId)).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un tag porte déjà ce nom.");
        }
        return tagRepository.save(new Tag(existant.id(), libelle));
    }

    @Operation(summary = "Delete a Tag and remove it from all works - reserved for administrators")
    @DeleteMapping("/{tagId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable UUID tagId) {
        if (tagRepository.findById(tagId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag introuvable : " + tagId);
        }
        // The links go with it, through the foreign key: a work only
        // loses the label, never anything else.
        tagRepository.supprimer(tagId);
    }

    @Operation(summary = "Remove a Tag from an Entity")
    @DeleteMapping("/entities/{entityId}/{tagId}")
    public void detachFromEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        entity.removeTag(tagId);
        entityRepository.save(entity);
    }
}
