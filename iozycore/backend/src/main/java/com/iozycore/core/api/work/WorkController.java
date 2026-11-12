package com.iozycore.core.api.work;

import com.iozycore.core.api.dto.WorkDtos.CollectionSummaryResponse;
import com.iozycore.core.api.dto.WorkDtos.CollectorStatusRequest;
import com.iozycore.core.api.dto.WorkDtos.CollectorStatusResponse;
import com.iozycore.core.api.dto.WorkDtos.WorkProgressResponse;
import com.iozycore.core.api.dto.WorkDtos.WorkResponse;
import com.iozycore.core.application.work.WorkElementOwning;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.application.work.WorkStoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/works")
@Tag(name = "Works", description = "A work and its elements (volumes, games, expansions), for every type")
@RequiredArgsConstructor
public class WorkController {

    private final WorkReadModel works;
    private final WorkElementOwning owning;
    private final WorkStoryService story;

    @Operation(summary = "What the work is about and, for a series, the story up to the last volume owned (written by a language model; says why when absent)")
    @GetMapping("/{entityId}/story")
    public WorkStoryService.Story story(@PathVariable UUID entityId) {
        return story.story(entityId);
    }

    @Operation(summary = "Every work the account owns or wishes, with its counts, most recently moved first")
    @GetMapping
    public List<WorkProgressResponse> list() {
        return works.works().stream().map(WorkProgressResponse::from).toList();
    }

    @Operation(summary = "The objects of the collection: one active copy = one object; added this month")
    @GetMapping("/summary")
    public CollectionSummaryResponse summary() {
        return CollectionSummaryResponse.from(works.summary());
    }

    @Operation(summary = "One work with its elements, counts and next release")
    @GetMapping("/{entityId}")
    public WorkResponse work(@PathVariable UUID entityId) {
        return WorkResponse.from(works.work(entityId));
    }

    @Operation(summary = "Set the collector status of a work: ONGOING, PAUSED or DROPPED (idempotent)")
    @PutMapping("/{entityId}/collector-status")
    public CollectorStatusResponse setCollectorStatus(@PathVariable UUID entityId,
                                                      @RequestBody CollectorStatusRequest request) {
        if (request == null || request.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Il faut dire où en est la série : ONGOING, PAUSED ou DROPPED");
        }
        return new CollectorStatusResponse(entityId, works.setCollectorStatus(entityId, request.status()));
    }

    @Operation(summary = "\"Je l'ai\": own one element of a work (a missing volume, expansion or game of the licence) "
            + "through the add path; idempotent. Returns the work as it now stands")
    @PostMapping("/{entityId}/elements/{elementKey}/own")
    public WorkResponse ownElement(@PathVariable UUID entityId, @PathVariable String elementKey) {
        return WorkResponse.from(owning.own(entityId, elementKey));
    }
}
