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
 * Importer sa bibliothèque depuis des photos de l'étagère.
 *
 * <p>Deux temps, comme l'import d'un export : une lecture qui n'écrit rien
 * ({@code /analyze-photos}), puis l'écriture de ce que l'utilisateur a
 * confirmé ({@code /apply}). Le serveur ne garde rien entre les deux.
 *
 * <p>Les photos sont envoyées à un moteur de vision externe quand une clé est
 * configurée ; sans clé, seuls les codes-barres visibles sont lus, en local.
 * Dans les deux cas la réponse le dit ({@code visionStatus}), et l'écran doit
 * le répéter : une étagère dont rien n'est lu n'est pas une panne.
 */
@RestController
@RequestMapping("/api/shelf-import")
@Tag(name = "Shelf import", description = "Importer sa bibliothèque depuis des photos de l'étagère")
public class ShelfImportController {

    private final ShelfImportService service;
    private final UploadedImageReader uploadedImageReader;

    public ShelfImportController(ShelfImportService service, UploadedImageReader uploadedImageReader) {
        this.service = service;
        this.uploadedImageReader = uploadedImageReader;
    }

    /** La fiche que les sources proposent pour une série absente du catalogue. */
    public record ProposalResponse(String source, String externalId, String title, String imageUrl,
                                   Map<String, Object> attributes) {
        static ProposalResponse from(MetadataCandidate candidate) {
            return candidate == null ? null : new ProposalResponse(candidate.source(), candidate.externalId(),
                    candidate.title(), candidate.imageUrl(),
                    candidate.attributes() == null ? Map.of() : candidate.attributes());
        }
    }

    /**
     * @param item         la lecture, telle que l'analyse d'annonce la rend - même forme, même écran
     * @param alreadyOwned un exemplaire de ce numéro est encore possédé : coché et inerte à l'écran
     * @param proposal     la fiche proposée pour une série inconnue, ou null
     */
    public record ShelfItemResponse(RecognitionController.RecognizedItemResponse item, boolean alreadyOwned,
                                    ProposalResponse proposal) {
        static ShelfItemResponse from(ShelfItem item) {
            return new ShelfItemResponse(RecognitionController.RecognizedItemResponse.from(item.resolved()),
                    item.alreadyOwned(), ProposalResponse.from(item.proposal()));
        }
    }

    public record ShelfAnalysisResponse(String visionStatus, List<ShelfItemResponse> items, int unidentifiedCount,
                                        int notInCatalogCount, int analyzedImageCount, int requestedImageCount,
                                        int lookupsSkipped) {
    }

    @Operation(summary = "Lire des photos de l'étagère : séries, tomes et éditions visibles, confrontés au "
            + "catalogue ET à la collection (alreadyOwned). Pour une série absente du catalogue, la fiche "
            + "que les sources proposent (proposal). Répond 200 même quand rien n'est lu : visionStatus dit "
            + "pourquoi. N'écrit RIEN.")
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
     * @param seriesTitle   le titre sous lequel la série est retrouvée ou créée
     * @param volumeNumber  lu sur la photo ou saisi - jamais deviné par le serveur
     * @param edition       l'édition choisie, absente si l'utilisateur ne la connaît pas
     * @param attributes    les attributs de la fiche proposée, si gardée
     * @param coverImageUrl la jaquette de la fiche proposée, si gardée
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

    /** Plus que ce qu'une étagère montre : au-delà, c'est une erreur d'appel, pas un import. */
    static final int TOMES_MAX_PAR_IMPORT = 500;

    @Operation(summary = "Ajouter à la collection les tomes confirmés depuis l'écran de vérification, en une "
            + "transaction. Chaque tome passe par l'ajout rapide (série retrouvée ou créée, tome retrouvé ou "
            + "créé, possession ajoutée). Un tome dont un exemplaire est encore possédé n'est pas ajouté une "
            + "seconde fois (outcome ALREADY_OWNED). 400 si un tome n'a pas de titre ou de numéro.")
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
