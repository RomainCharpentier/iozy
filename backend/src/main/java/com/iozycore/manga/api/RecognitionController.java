package com.iozycore.manga.api;

import com.iozycore.manga.recognition.CatalogStatus;
import com.iozycore.manga.recognition.ListingRecognitionService;
import com.iozycore.manga.recognition.RecognitionContext;
import com.iozycore.manga.recognition.RecognitionImage;
import com.iozycore.manga.recognition.RecognitionImageLimits;
import com.iozycore.manga.recognition.RecognitionSource;
import com.iozycore.manga.recognition.ResolvedItem;
import com.iozycore.manga.recognition.UploadedImageReader;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Proposes what a listing probably contains, from its text and,
 * if asked, from its photos.
 *
 * <h2>One route, two uses, a single cost when needed</h2>
 * {@code imageUrls} is <b>optional</b>, and that is the whole mechanism:
 * <ul>
 *   <li><b>without</b> photos: only the text is read, locally. <b>No engine
 *       is called</b>, no image is downloaded. This is the call made
 *       automatically when a listing has just been fetched;</li>
 *   <li><b>with</b> photos: the text is read again and the photos are analysed,
 *       then everything is consolidated together. This is the call made on the click
 *       "Analyser les photos".</li>
 * </ul>
 * The presence of photos in the body <b>is</b> the consent. There is
 * no path by which loading a listing triggers a paid call.
 *
 * <h2>One single consolidation, on the domain side</h2>
 * The client never assembles two lists: it sends what it has and receives
 * <b>one</b> list. The merge rules (same series + same volume, compatible
 * editions, multiple photos) live in
 * {@code RecognitionConsolidator} and nowhere else - above all not
 * rewritten in TypeScript.
 *
 * <h2>What this route does not do</h2>
 * It writes <b>nothing</b>. No Ownership, no Wishlist, no Entity,
 * no Edition, no Volume. It returns proposals to confirm. This is
 * also why it is a POST despite having no effect: it carries a
 * body and triggers a processing, which a GET must not do.
 *
 * <h2>Always 200, except for an invalid request</h2>
 * Nothing recognised, engine down, unreadable photos, no engine configured:
 * normal outcomes of the flow, told apart by {@code visionStatus}. A
 * red banner would confuse "these photos show nothing readable" with
 * "the service is broken".
 */
@RestController
@RequestMapping("/api/recognition")
@Tag(name = "Recognition", description = "Detect the items of a listing from its text and its photos")
public class RecognitionController {

    private final ListingRecognitionService service;
    private final UploadedImageReader uploadedImageReader;

    public RecognitionController(ListingRecognitionService service, UploadedImageReader uploadedImageReader) {
        this.service = service;
        this.uploadedImageReader = uploadedImageReader;
    }

    /**
     * @param title       title of the listing - read locally, never sent to an external engine
     * @param description description of the listing - same
     * @param imageUrls   photos to analyse. <b>Missing or empty = text-only analysis</b>,
     *                    so no engine call
     * @param entityTypeCode expected universe ("MANGA") - V1 is only validated on that one
     */
    public record AnalyzeListingRequest(String title, String description, List<String> imageUrls,
                                         String entityTypeCode) {
    }

    /** Where the book was seen: the photo (sending index) and a rectangle in fractions from 0 to 1. */
    public record BoxResponse(int image, double top, double left, double bottom, double right) {
    }

    public record RecognizedItemResponse(String seriesTitle, String seriesTitleAsRead, Integer volumeNumber,
                                          String editionHint, boolean hasExactIdentifier,
                                          String confidence, List<String> sources, List<String> sourceLabels,
                                          List<String> evidence, List<Integer> sourceImages,
                                          List<BoxResponse> boxes,
                                          String catalogStatus, UUID entityId,
                                          List<EditionOptionResponse> editionOptions,
                                          boolean preselected, boolean readyForAnalysis) {

        static RecognizedItemResponse from(ResolvedItem item) {
            List<RecognitionSource> sources = item.recognized().sources().stream()
                    .sorted(java.util.Comparator.comparingInt(RecognitionSource::priority).reversed())
                    .toList();
            return new RecognizedItemResponse(
                    item.displayTitle(),
                    // What was read, kept apart: the user must be able to
                    // see the gap between the listing and the catalog.
                    item.recognized().seriesTitleRaw(),
                    item.recognized().volumeNumber(),
                    item.recognized().editionHint(),
                    item.recognized().hasExactIdentifier(),
                    item.recognized().confidence().name(),
                    sources.stream().map(Enum::name).toList(),
                    // The label talks about the data ("annonce", "photos"),
                    // never about the AI provider.
                    sources.stream().map(RecognitionSource::label).toList(),
                    item.recognized().evidence(),
                    List.copyOf(item.recognized().sourceImages()),
                    item.recognized().boxes().stream()
                            .map(b -> new BoxResponse(b.imageIndex(), b.top(), b.left(), b.bottom(), b.right()))
                            .toList(),
                    item.catalogStatus().name(),
                    item.entityId(),
                    item.editionOptions().stream().map(EditionOptionResponse::from).toList(),
                    item.preselected(),
                    item.readyForAnalysis());
        }
    }

    public record EditionOptionResponse(UUID editionId, String editionName, Integer totalVolumes) {
        static EditionOptionResponse from(ResolvedItem.EditionOption option) {
            return new EditionOptionResponse(option.editionId(), option.editionName(), option.totalVolumes());
        }
    }

    /**
     * @param visionStatus  {@code null} when no photo was requested - not to be
     *                      confused with a reading failure
     * @param textItemCount what the text alone produced: lets us say "the listing
     *                      already describes N" before any image analysis
     * @param unidentifiedCount items seen but not identified - to show, otherwise
     *                      the user believes the batch is smaller than it is
     */
    public record AnalyzeListingResponse(String visionStatus, List<RecognizedItemResponse> items,
                                          int unidentifiedCount, int notInCatalogCount, int textItemCount,
                                          int analyzedImageCount, int requestedImageCount,
                                          Integer announcedVolumeCount, String announcedSeriesTitle) {
    }

    @Operation(summary = "Detect the items of a listing. The title and the description are ALWAYS read, "
            + "locally and at no cost. The photos are analysed only if imageUrls is given - this is the "
            + "only trigger of an engine call. Always answers 200: visionStatus tells apart success, "
            + "partial result, nothing recognised, no usable photo, engine not configured and engine "
            + "unavailable; it is null when no photo was requested. Writes NOTHING - no ownership, "
            + "no wish, no catalog page.")
    @PostMapping("/analyze")
    public AnalyzeListingResponse analyze(@RequestBody AnalyzeListingRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un corps de requête est attendu");
        }
        boolean texteVide = (request.title() == null || request.title().isBlank())
                && (request.description() == null || request.description().isBlank());
        boolean sansPhoto = request.imageUrls() == null || request.imageUrls().isEmpty();
        if (texteVide && sansPhoto) {
            // Neither text nor photo: there is literally nothing to analyse.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Un titre, une description ou au moins une photo est requis");
        }
        if (!sansPhoto && request.imageUrls().size() > RecognitionImageLimits.MAX_IMAGES) {
            // Limit stated explicitly rather than silently truncated:
            // the caller must know that their request was not fully processed.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de photos : %d au maximum".formatted(RecognitionImageLimits.MAX_IMAGES));
        }

        ListingRecognitionService.Analysis analyse = service.analyze(
                request.title(), request.description(), request.imageUrls(),
                new RecognitionContext(request.entityTypeCode()));

        return repondre(analyse);
    }

    /**
     * Analysis of photos <b>sent by the user</b>, rather than
     * fetched from a listing.
     *
     * <h2>What this route unlocks</h2>
     * The vision engine had only one door: URLs on hosts in a
     * whitelist. IozyCore was therefore blind as soon as the photos were
     * not reachable - a platform that refuses robots, a listing whose
     * text names no series, a shelf photographed at home.
     * In all these cases the user has the images; what was missing was the way
     * to give them.
     *
     * <h2>Multipart, not base64 in the JSON</h2>
     * Encoding three photos in base64 would inflate them by a third and make
     * 16 MB of character string travel in a JSON body, to be parsed
     * in one block in memory. Multipart is read as a stream and is limited while
     * being read.
     *
     * <h2>Sending is consenting</h2>
     * As for {@code imageUrls}, the presence of photos <b>is</b> the
     * trigger: no path sends an image without an explicit action.
     *
     * @param photos      the images; eight at most, 3 MB each. The type is
     *                    determined from the bytes, not from the declared header
     * @param title       title entered - read locally, never sent to an engine
     * @param description description entered - same
     */
    @Operation(summary = "Detect the items of a batch from photos SENT by the user. "
            + "Used when the photos cannot be fetched: platform that refuses automatic "
            + "reading, listing without usable text, or a simple shelf photo. No URL is "
            + "received or attached. The title and the description stay optional and read locally. "
            + "Always answers 200 except for an invalid request, with the same visionStatus as /analyze. "
            + "Writes NOTHING.")
    @PostMapping(value = "/analyze-photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AnalyzeListingResponse analyzeUploadedPhotos(
            @RequestPart("photos") List<MultipartFile> photos,
            // @RequestParam and not @RequestPart: on a String, @RequestPart
            // requires a Content-Type on the part, which the FormData of a
            // browser does not set - the request would fail with 415.
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "entityTypeCode", required = false) String entityTypeCode) {

        if (photos == null || photos.isEmpty() || photos.stream().allMatch(MultipartFile::isEmpty)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Au moins une photo est requise");
        }
        if (photos.size() > RecognitionImageLimits.MAX_IMAGES) {
            // Stated rather than silently truncated: the caller must know that their
            // request was not fully processed.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de photos : %d au maximum".formatted(RecognitionImageLimits.MAX_IMAGES));
        }

        UploadedImageReader.Intake intake = uploadedImageReader.read(photos);
        List<RecognitionImage> images = intake.images();

        // requestedImageCount stays the number SENT: it is the gap with
        // analyzedImageCount that lets us say "2 photos out of 5 were
        // unreadable" instead of making the other three disappear.
        ListingRecognitionService.Analysis analyse = service.analyzeUploadedPhotos(
                title, description, images, new RecognitionContext(entityTypeCode), photos.size());

        return repondre(analyse);
    }

    private static AnalyzeListingResponse repondre(ListingRecognitionService.Analysis analyse) {
        return new AnalyzeListingResponse(
                analyse.visionStatus() == null ? null : analyse.visionStatus().name(),
                analyse.items().stream().map(RecognizedItemResponse::from).toList(),
                analyse.unidentifiedCount(),
                (int) analyse.items().stream()
                        .filter(item -> item.catalogStatus() == CatalogStatus.NOT_IN_CATALOG)
                        .count(),
                analyse.textItemCount(),
                analyse.analyzedImageCount(),
                analyse.requestedImageCount(),
                // "9 volumes of Naruto": what the listing claims, without saying
                // which ones. Shown next to the proposals and never inside them -
                // unrolling 1 to 9 would make up a purchase verdict computed on
                // volumes that nobody has seen.
                analyse.announcedVolumeCount(),
                analyse.announcedSeriesTitle());
    }
}
