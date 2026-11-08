package com.iozycore.manga.api;

import com.iozycore.manga.application.EditionTotalService;
import com.iozycore.manga.domain.MangaEdition;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

/** The volume count of a French edition, set or cleared by a person (lot 207). */
@RestController
@RequestMapping("/api/manga/series")
@RequiredArgsConstructor
public class MangaSeriesTotalController {

    private final EditionTotalService editionTotalService;

    /** {@code totalVolumes: null} clears the total; {@code editionName} may be left out for a single edition. */
    public record SetTotalRequest(String editionName, Integer totalVolumes) {
    }

    /**
     * The edition and where its total comes from.
     *
     * @param totalSource       MANUAL (typed by a person), PROVIDER (read in the French volume lists), or null
     * @param frenchRunFinished true only when a source says the French run is over
     * @param totalCheckedAt    the last time the background job read the sources for it, or null
     */
    public record EditionTotalResponse(UUID editionId, UUID entityId, String editionName, Integer totalVolumes,
                                       String totalSource, boolean frenchRunFinished, Instant totalCheckedAt) {

        static EditionTotalResponse of(MangaEdition edition) {
            return new EditionTotalResponse(edition.id(), edition.entityId(), edition.editionName(),
                    edition.totalVolumes(), edition.totalSource() == null ? null : edition.totalSource().name(),
                    edition.frenchRunFinished(), edition.totalCheckedAt());
        }
    }

    @Operation(summary = "Set the volume count of a French edition by hand (stored as MANUAL, never touched by the "
            + "background job), or clear it with totalVolumes: null so the job tries again. editionName may be "
            + "omitted when the series has a single named edition. 404 for an unknown series, 400 for a total "
            + "below 1, a non-manga series or an ambiguous edition.")
    @PutMapping("/{entityId}/total")
    public EditionTotalResponse setTotal(@PathVariable UUID entityId, @RequestBody SetTotalRequest request) {
        return EditionTotalResponse.of(
                editionTotalService.setTotal(entityId, request.editionName(), request.totalVolumes()));
    }
}
