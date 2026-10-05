package com.iozycore.manga.api;

import com.iozycore.core.application.WorkFollowing;

import com.iozycore.manga.api.FollowedEditionDtos.FollowEditionRequest;
import com.iozycore.manga.api.FollowedEditionDtos.FollowedEditionResponse;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * "The edition I collect" for a series (see
 * com.iozycore.core.domain.followededition, and the FOLLOWED badge of the mockup
 * "Series page - multi-editions").
 */
@RestController
@RequestMapping("/api/followed-editions")
@Tag(name = "Followed editions", description = "The edition of a series that the user collects")
public class FollowedEditionController {

    private final FollowedEditionRepository followedEditionRepository;
    private final EntityRepository entityRepository;
    private final WorkFollowing workFollowing;

    public FollowedEditionController(FollowedEditionRepository followedEditionRepository,
                                     EntityRepository entityRepository,
                                     WorkFollowing workFollowing) {
        this.followedEditionRepository = followedEditionRepository;
        this.entityRepository = entityRepository;
        this.workFollowing = workFollowing;
    }

    /**
     * PUT and not POST: following an edition is IDEMPOTENT - there is only
     * one per series, and asking for the same one again must not create anything new.
     * The upsert goes through {@code suivreALaPlace}, which keeps the same row
     * instead of chaining a DELETE and an INSERT (see FollowedEdition).
     */
    @Operation(summary = "Follow an edition of a series (replaces the one already followed, if any)")
    @PutMapping
    public FollowedEditionResponse follow(@RequestBody FollowEditionRequest request) {
        entityRepository.findById(request.entityId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Entité introuvable : " + request.entityId()));
        FollowedEdition aEnregistrer = followedEditionRepository.findByEntityId(request.entityId())
                .map(existante -> existante.suivreALaPlace(request.editionName()))
                .orElseGet(() -> FollowedEdition.create(request.entityId(), request.editionName()));
        FollowedEditionResponse reponse = FollowedEditionResponse.from(followedEditionRepository.save(aEnregistrer));
        // Following an edition means following the series (the Followed state of the core): this is
        // what makes it enter the release calendar.
        workFollowing.follow(request.entityId());
        return reponse;
    }

    @Operation(summary = "Stop following an edition for this series")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(@RequestParam UUID entityId) {
        followedEditionRepository.deleteByEntityId(entityId);
    }

    /**
     * Returns a LIST and not an object or a 404: "no followed edition"
     * is a perfectly normal state (a series with a single edition has nothing to
     * choose), and the client must not have to tell this case from a failure. An
     * empty list is read without error handling, where a 404 would force
     * every caller to neutralise it - a trap already met with
     * {@code findEdition}, whose calls all carry a {@code retry:false}
     * for this reason only.
     */
    @Operation(summary = "The followed edition of a series (empty list if none)")
    @GetMapping
    public List<FollowedEditionResponse> byEntity(@RequestParam UUID entityId) {
        return followedEditionRepository.findByEntityId(entityId).stream()
                .map(FollowedEditionResponse::from)
                .collect(Collectors.toList());
    }
}
