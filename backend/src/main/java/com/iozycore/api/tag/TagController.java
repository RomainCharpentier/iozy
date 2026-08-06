package com.iozycore.api.tag;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tags")
public class TagController {

    public record CreateTagRequest(String label) {
    }

    private final TagRepository tagRepository;
    private final EntityRepository entityRepository;

    public TagController(TagRepository tagRepository, EntityRepository entityRepository) {
        this.tagRepository = tagRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Créer un Tag (réutilisable sur plusieurs Entity)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Tag create(@RequestBody CreateTagRequest request) {
        return tagRepository.findByLabel(request.label())
                .orElseGet(() -> tagRepository.save(new Tag(UUID.randomUUID(), request.label())));
    }

    @Operation(summary = "Lister tous les Tags existants")
    @GetMapping
    public List<Tag> listAll() {
        return tagRepository.findAll();
    }

    @Operation(summary = "Associer un Tag existant à une Entity")
    @PostMapping("/entities/{entityId}/{tagId}")
    public void attachToEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        entity.addTag(tagId);
        entityRepository.save(entity);
    }

    @Operation(summary = "Retirer un Tag d'une Entity")
    @DeleteMapping("/entities/{entityId}/{tagId}")
    public void detachFromEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        entity.removeTag(tagId);
        entityRepository.save(entity);
    }
}
