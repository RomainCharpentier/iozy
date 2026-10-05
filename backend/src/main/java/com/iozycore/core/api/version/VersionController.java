package com.iozycore.core.api.version;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Which delivery is running, right now, on this server.
 *
 * <h2>Why this route exists</h2>
 * Since updates became automatic, nobody knows by heart
 * what is online: we push, and something arrives five minutes
 * later. Facing unexpected behavior, the first question is no longer
 * "what is wrong?" but "is my fix even
 * deployed?" - and without an answer, we look for a bug in code that is not
 * there yet.
 *
 * <h2>A delivery number, and not the pom number</h2>
 * {@code 0.1.0-SNAPSHOT} never moves: it does not tell two
 * deployments apart. The delivery number, on the other hand, is a Major.Minor.Patch
 * <b>deduced from the commit messages</b> at publication time (the rule
 * lives in {@code web/scripts/version.mjs}) — it grows, so <b>it can
 * be compared</b>: "server 1.2.0" under "version 1.3.1" immediately says
 * which of the two images is late, which a SHA will never say. And it
 * says what changed: a minor added, a patch fixed.
 *
 * <p>This same number tags the image in GHCR ({@code -api:v1.3.1}) and the
 * delivered commit ({@code git show v1.3.1}). A single identifier therefore links
 * the screen, the image and the commit.
 *
 * <h2>Authenticated, like almost everything else</h2>
 * It is not among the exceptions of {@code SecurityConfig}: knowing
 * the exact version of a server is information for an attacker as much as
 * for an operator, and nobody needs to read it <b>before</b> signing in.
 * A guest does see it - they are authenticated in the sense of the
 * security chain, and it is not a secret from someone we already let
 * browse the collection.
 */
@RestController
@RequestMapping("/api/version")
@Tag(name = "Version", description = "The delivery currently running")
public class VersionController {

    private final String version;

    public VersionController(@Value("${iozycore.version:dev}") String version) {
        this.version = version;
    }

    /**
     * {@code version} is the number of the current delivery ({@code "1.3.1"}),
     * or {@code dev} outside a container. It is a string and not an integer: it
     * must be able to carry {@code dev}, and the client only displays it and
     * compares it to its own - never arithmetic on it.
     */
    public record VersionReponse(String version) {
    }

    @Operation(summary = "The number of the current delivery, or \"dev\" outside a container.")
    @GetMapping
    public VersionReponse version() {
        return new VersionReponse(version);
    }
}
