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
        // 400 et non 404 : l'endpoint existe, c'est le CORPS envoyé qui référence
        // une œuvre inconnue - même refus que /wishlist et
        // /tier-lists/general (Lot 28, mise en cohérence). Le 404 avait en outre un effet de bord côté client, qui
        // remplace tout message de 404 par un repli traduit (voir Lot 26) : la
        // raison réelle n'arrivait jamais à l'écran.
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

    @Operation(summary = "Corriger la note et/ou le commentaire d'une expérience (les deux champs sont "
            + "remplacés tels quels, null compris - voir UpdateExperienceRequest)")
    @PatchMapping("/{id}")
    public ExperienceResponse update(@PathVariable UUID id, @RequestBody UpdateExperienceRequest request) {
        Experience experience = experienceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Expérience introuvable : " + id));
        try {
            // La borne 0-10 vit dans le domaine (Experience.updateRating) : la
            // rejouer ici la dupliquerait. On traduit juste son refus en 400,
            // sans quoi une note hors bornes remonterait en 500.
            experience.updateRating(request.rating());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        experience.updateComment(request.comment());
        return ExperienceResponse.from(experienceRepository.save(experience));
    }

    @Operation(summary = "Supprimer une expérience enregistrée par erreur - idempotent")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        experienceRepository.deleteById(id);
    }

    @Operation(summary = "Lister les Experience d'une Entity")
    @GetMapping
    public List<ExperienceResponse> byEntity(@RequestParam UUID entityId) {
        return experienceRepository.findByEntityId(entityId).stream()
                .map(ExperienceResponse::from)
                .collect(Collectors.toList());
    }
}
