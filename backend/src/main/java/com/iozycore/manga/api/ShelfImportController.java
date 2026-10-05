package com.iozycore.manga.api;

import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.manga.recognition.CatalogStatus;
import com.iozycore.manga.recognition.RecognitionImage;
import com.iozycore.manga.recognition.RecognitionImageLimits;
import com.iozycore.manga.recognition.UploadedImageReader;
import com.iozycore.manga.shelfimport.ItemToImport;
import com.iozycore.manga.shelfimport.ShelfAnalysis;
import com.iozycore.manga.shelfimport.ShelfImportReport;
import com.iozycore.manga.shelfimport.ShelfImportService;
import com.iozycore.manga.shelfimport.ShelfItem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Import your library from photos of the shelf.
 *
 * <p>Two steps, like the import of an export: a read that writes nothing
 * ({@code /analyze-photos}), then the writing of what the user
 * confirmed ({@code /apply}). The server keeps nothing between the two.
 *
 * <p>The photos are sent to an external vision engine when a key is
 * configured; without a key, only the visible barcodes are read, locally.
 * In both cases the response says so ({@code visionStatus}), and the screen must
 * repeat it: a shelf from which nothing is read is not a failure.
 */
@RestController
@RequestMapping("/api/shelf-import")
@Tag(name = "Shelf import", description = "Import your library from photos of the shelf")
public class ShelfImportController {

    private final ShelfImportService service;
    private final UploadedImageReader uploadedImageReader;

    public ShelfImportController(ShelfImportService service, UploadedImageReader uploadedImageReader) {
        this.service = service;
        this.uploadedImageReader = uploadedImageReader;
    }

    /** The detail page that the sources propose for a series missing from the catalog. */
    public record ProposalResponse(String source, String externalId, String title, String imageUrl,
                                   Map<String, Object> attributes) {
        static ProposalResponse from(MetadataCandidate candidate) {
            return candidate == null ? null : new ProposalResponse(candidate.source(), candidate.externalId(),
                    candidate.title(), candidate.imageUrl(),
                    candidate.attributes() == null ? Map.of() : candidate.attributes());
        }
    }

    /**
     * @param item            the reading, as the listing analysis returns it - same shape, same screen
     * @param alreadyOwned    a copy of this number is still owned: ticked and inert on screen
     * @param proposal        the detail page proposed for an unknown series, or null
     * @param proposalByTitle true if the title of the detail page matches what was read (kept
     *                        by default); false if it is only the first result of the
     *                        search (shown, kept only on an action)
     */
    public record ShelfItemResponse(RecognitionController.RecognizedItemResponse item, boolean alreadyOwned,
                                    ProposalResponse proposal, boolean proposalByTitle) {
        static ShelfItemResponse from(ShelfItem item) {
            return new ShelfItemResponse(RecognitionController.RecognizedItemResponse.from(item.resolved()),
                    item.alreadyOwned(), ProposalResponse.from(item.proposal()), item.proposalByTitle());
        }
    }

    public record ShelfAnalysisResponse(String visionStatus, List<ShelfItemResponse> items, int unidentifiedCount,
                                        int notInCatalogCount, int analyzedImageCount, int requestedImageCount,
                                        int lookupsSkipped) {
    }

    @Operation(summary = "Read photos of the shelf: visible series, volumes and editions, checked against the "
            + "catalog AND the collection (alreadyOwned). For a series missing from the catalog, the detail page "
            + "that the sources propose (proposal). Answers 200 even when nothing is read: visionStatus says "
            + "why. Writes NOTHING.")
    @PostMapping(value = "/analyze-photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ShelfAnalysisResponse analyzePhotos(@RequestPart("photos") List<MultipartFile> photos) {
        if (photos == null || photos.isEmpty() || photos.stream().allMatch(MultipartFile::isEmpty)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Au moins une photo est requise");
        }
        if (photos.size() > RecognitionImageLimits.MAX_IMAGES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de photos : %d au maximum".formatted(RecognitionImageLimits.MAX_IMAGES));
        }

        UploadedImageReader.Intake intake = uploadedImageReader.read(photos);
        List<RecognitionImage> images = intake.images();

        ShelfAnalysis analyse = service.analyze(images, photos.size());

        return new ShelfAnalysisResponse(
                analyse.visionStatus() == null ? null : analyse.visionStatus().name(),
                analyse.items().stream().map(ShelfItemResponse::from).toList(),
                analyse.unidentifiedCount(),
                (int) analyse.items().stream()
                        .filter(i -> i.resolved().catalogStatus() == CatalogStatus.NOT_IN_CATALOG)
                        .count(),
                analyse.analyzedImageCount(),
                analyse.requestedImageCount(),
                analyse.lookupsSkipped());
    }

    /**
     * @param seriesTitle   the title under which the series is found or created
     * @param volumeNumber  read from the photo or typed - never guessed by the server
     * @param edition       the chosen edition, missing if the user does not know it
     * @param attributes    the attributes of the proposed detail page, if kept
     * @param coverImageUrl the cover of the proposed detail page, if kept
     */
    public record ItemRequest(String seriesTitle, Integer volumeNumber, String edition,
                              Map<String, Object> attributes, String coverImageUrl) {
    }

    public record ApplyRequest(List<ItemRequest> items) {
    }

    public record ImportedItemResponse(String seriesTitle, int volumeNumber, String edition, String outcome,
                                       boolean seriesCreated, UUID entityId) {
        static ImportedItemResponse from(ShelfImportReport.ImportedItem item) {
            return new ImportedItemResponse(item.seriesTitle(), item.volumeNumber(), item.edition(),
                    item.outcome().name(), item.seriesCreated(), item.entityId());
        }
    }

    public record ApplyResponse(List<ImportedItemResponse> items, long added, long alreadyOwned,
                                long seriesCreated) {
    }

    /** More than what a shelf shows: beyond that, it is a call error, not an import. */
    static final int TOMES_MAX_PAR_IMPORT = 500;

    @Operation(summary = "Add to the collection the volumes confirmed from the review screen, in one "
            + "transaction. Each volume goes through quick add (series found or created, volume found or "
            + "created, ownership added). A volume of which a copy is still owned is not added a "
            + "second time (outcome ALREADY_OWNED). 400 if a volume has no title or number.")
    @PostMapping("/apply")
    public ApplyResponse apply(@RequestBody ApplyRequest request) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucun tome à importer");
        }
        if (request.items().size() > TOMES_MAX_PAR_IMPORT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de tomes : %d au maximum par import".formatted(TOMES_MAX_PAR_IMPORT));
        }

        List<ItemToImport> items = request.items().stream().map(ShelfImportController::versDomaine).toList();
        ShelfImportReport rapport = service.apply(items);

        return new ApplyResponse(rapport.items().stream().map(ImportedItemResponse::from).toList(),
                rapport.added(), rapport.alreadyOwned(), rapport.seriesCreated());
    }

    private static ItemToImport versDomaine(ItemRequest item) {
        if (item == null || item.seriesTitle() == null || item.seriesTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chaque tome doit nommer sa série");
        }
        if (item.volumeNumber() == null || item.volumeNumber() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le numéro du tome de « %s » doit être supérieur ou égal à 1".formatted(item.seriesTitle()));
        }
        return new ItemToImport(item.seriesTitle(), item.volumeNumber(), item.edition(), item.attributes(),
                item.coverImageUrl());
    }
}
