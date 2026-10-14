package com.iozycore.core.api.experience;

import com.iozycore.core.api.dto.ExperienceDtos.ExperienceResponse;
import com.iozycore.core.api.dto.ExperienceDtos.RecordExperienceRequest;
import com.iozycore.core.api.dto.ExperienceDtos.UpdateExperienceRequest;
import com.iozycore.core.application.ExperienceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/experiences")
@Tag(name = "Experiences", description = "UC3 - lived experiences, independent of Ownerships")
@RequiredArgsConstructor
public class ExperienceController {

    private final ExperienceService experienceService;

    @Operation(summary = "Record an Experience (read/played/finished...), without requiring ownership")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienceResponse record(@RequestBody RecordExperienceRequest request) {
        return ExperienceResponse.from(experienceService.record(request.entityId(), request.variantId(),
                request.experienceType(), request.occurredAt(), request.rating(), request.comment()));
    }

    @Operation(summary = "Fix the rating and/or comment of an experience (both fields are "
            + "replaced as they are, null included - see UpdateExperienceRequest)")
    @PatchMapping("/{id}")
    public ExperienceResponse update(@PathVariable UUID id, @RequestBody UpdateExperienceRequest request) {
        return ExperienceResponse.from(experienceService.update(id, request.rating(), request.comment()));
    }

    @Operation(summary = "Delete an experience recorded by mistake - idempotent")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        experienceService.delete(id);
    }

    @Operation(summary = "List the Experiences of an Entity")
    @GetMapping
    public List<ExperienceResponse> byEntity(@RequestParam UUID entityId) {
        return experienceService.ofEntity(entityId).stream()
                .map(ExperienceResponse::from)
                .collect(Collectors.toList());
    }
}
