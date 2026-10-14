package com.iozycore.core.api.experience;

import com.iozycore.core.api.dto.ExperienceDtos.ExperienceResponse;
import com.iozycore.core.api.dto.ExperienceDtos.RecordExperienceRequest;
import com.iozycore.core.api.dto.ExperienceDtos.UpdateExperienceRequest;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/experiences")
@Tag(name = "Experiences", description = "UC3 - lived experiences, independent of Ownerships")
@RequiredArgsConstructor
public class ExperienceController {

    private final ExperienceRepository experienceRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;

    @Operation(summary = "Record an Experience (read/played/finished...), without requiring ownership")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienceResponse record(@RequestBody RecordExperienceRequest request) {
        // 400 and not 404: the endpoint exists, it is the BODY sent that references
        // an unknown work - same refusal as /wishlist and
        // /tier-lists/general (Batch 28, consistency fix). The 404 also had a side effect on the client, which
        // replaces any 404 message with a translated fallback (see Batch 26): the
        // real reason never reached the screen.
        Entity entity = entityRepository.findById(request.entityId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Entité introuvable : " + request.entityId()));

        EntityType entityType = entityTypeRepository.findById(entity.entityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "EntityType inconnu pour cette Entity"));

        if (!entityType.allows(request.experienceType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Type d'expérience '%s' non autorisé pour le type '%s'"
                            .formatted(request.experienceType(), entityType.code()));
        }

        if (request.variantId() != null && entity.variants().stream().noneMatch(v -> v.id().equals(request.variantId()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Variant introuvable sur cette Entity : " + request.variantId());
        }

        Experience experience = Experience.record_(
                request.entityId(), request.variantId(), request.experienceType(), request.occurredAt(),
                request.rating(), request.comment());

        return ExperienceResponse.from(experienceRepository.save(experience));
    }

    @Operation(summary = "Fix the rating and/or comment of an experience (both fields are "
            + "replaced as they are, null included - see UpdateExperienceRequest)")
    @PatchMapping("/{id}")
    public ExperienceResponse update(@PathVariable UUID id, @RequestBody UpdateExperienceRequest request) {
        Experience experience = experienceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Expérience introuvable : " + id));
        try {
            // The 0-10 bound lives in the domain (Experience.updateRating):
            // replaying it here would duplicate it. We only translate its refusal into a 400,
            // without which an out-of-range rating would come up as a 500.
            experience.updateRating(request.rating());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        experience.updateComment(request.comment());
        return ExperienceResponse.from(experienceRepository.save(experience));
    }

    @Operation(summary = "Delete an experience recorded by mistake - idempotent")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        experienceRepository.deleteById(id);
    }

    @Operation(summary = "List the Experiences of an Entity")
    @GetMapping
    public List<ExperienceResponse> byEntity(@RequestParam UUID entityId) {
        return experienceRepository.findByEntityId(entityId).stream()
                .map(ExperienceResponse::from)
                .collect(Collectors.toList());
    }
}
