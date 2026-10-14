package com.iozycore.core.api.share;

import com.iozycore.core.application.share.SharedSpace;
import com.iozycore.core.application.share.SharedSpaceQuery;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The ONLY controller designed to be opened by someone other than the owner.
 * It asks for no authentication, on purpose: the person who receives the link
 * has no account. An unknown, revoked, empty or absent token gives a <b>bare
 * 404</b>. What is read and filtered is decided by {@link SharedSpaceQuery}.
 */
@RestController
@RequestMapping("/api/public/share")
@Tag(name = "Shared space", description = "Read only, unauthenticated, reserved for the holder of the link")
@RequiredArgsConstructor
public class PublicShareController {

    private final SharedSpaceQuery sharedSpaceQuery;

    @Operation(summary = "Read-only shared space through a token. 404 if the link does not exist or was "
            + "deleted. A section that is not shared is null in the response, never an empty list: "
            + "[] would say \"shared but nothing in it\", null says \"no access\".")
    @GetMapping("/{token}")
    public SharedSpace shared(@PathVariable String token) {
        return sharedSpaceQuery.read(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lien introuvable"));
    }
}
