package com.iozycore.core.api.follow;

import com.iozycore.core.api.dto.FollowedWorkDtos.FollowRequest;
import com.iozycore.core.api.dto.FollowedWorkDtos.FollowedWorkResponse;
import com.iozycore.core.application.WorkFollowing;
import com.iozycore.core.domain.follow.FollowedWorkRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/** Les œuvres suivies du compte : le troisième état, à côté des possessions et des envies. */
@RestController
@RequestMapping("/api/followed-works")
@Tag(name = "Œuvres suivies", description = "Suivre une œuvre : en attendre les sorties (calendrier)")
public class FollowedWorkController {

    private final WorkFollowing workFollowing;
    private final FollowedWorkRepository followedWorkRepository;

    public FollowedWorkController(WorkFollowing workFollowing, FollowedWorkRepository followedWorkRepository) {
        this.workFollowing = workFollowing;
        this.followedWorkRepository = followedWorkRepository;
    }

    @Operation(summary = "Suivre une œuvre (idempotent). Retire l'envie de l'œuvre : un état à la fois.")
    @PutMapping
    public FollowedWorkResponse follow(@RequestBody FollowRequest request) {
        if (request == null || request.entityId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Il faut désigner l'œuvre à suivre (entityId)");
        }
        return FollowedWorkResponse.from(workFollowing.follow(request.entityId()));
    }

    @Operation(summary = "Ne plus suivre une œuvre (idempotent)")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(@RequestParam UUID entityId) {
        workFollowing.unfollow(entityId);
    }

    @Operation(summary = "Lister les œuvres suivies du compte")
    @GetMapping
    public List<FollowedWorkResponse> list() {
        return followedWorkRepository.findAll().stream().map(FollowedWorkResponse::from).toList();
    }
}
