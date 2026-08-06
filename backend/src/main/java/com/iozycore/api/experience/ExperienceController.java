package com.iozycore.api.experience;

import com.iozycore.api.dto.ExperienceDtos.ExperienceResponse;
import com.iozycore.api.dto.ExperienceDtos.RecordExperienceRequest;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/experiences")
@Tag(name = "Experiences", description = "UC3 - expériences vécues, indépendantes des Ownership")
public class ExperienceController {

    private final ExperienceRepository experienceRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;

    public ExperienceController(ExperienceRepository experienceRepository, EntityRepository entityRepository,
                                 EntityTypeRepository entityTypeRepository) {
        this.experienceRepository = experienceRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
    }

    @Operation(summary = "Enregistrer une Experience (lu/joué/terminé...), sans exiger de possession")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienceResponse record(@RequestBody RecordExperienceRequest request) {
        Entity entity = entityRepository.findById(request.entityId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Entity introuvable : " + request.entityId()));

        EntityType entityType = entityTypeRepository.findById(entity.entityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "EntityType inconnu pour cette Entity"));

        if (!entityType.allows(request.experienceType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Type d'expérience '%s' non autorisé pour le type '%s'"
                            .formatted(request.experienceType(), entityType.code()));
        }

        Experience experience = Experience.record_(
                request.entityId(), request.experienceType(), request.occurredAt(),
                request.rating(), request.comment());

        return ExperienceResponse.from(experienceRepository.save(experience));
    }

    @Operation(summary = "Lister les Experience d'une Entity")
    @GetMapping
    public List<ExperienceResponse> byEntity(@RequestParam UUID entityId) {
        return experienceRepository.findByEntityId(entityId).stream()
                .map(ExperienceResponse::from)
                .collect(Collectors.toList());
    }
}
