package com.iozycore.api.recognition;

import com.iozycore.recognition.CatalogStatus;
import com.iozycore.recognition.ImageRecognitionService;
import com.iozycore.recognition.RecognitionContext;
import com.iozycore.recognition.RecognitionImageFetcher;
import com.iozycore.recognition.ResolvedItem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Propose ce qu'IozyCore croit voir sur des photos.
 *
 * <h2>Un domaine, pas un écran</h2>
 * La route vit sous {@code /api/image-recognition} et non sous
 * {@code /purchase-analysis} ou {@code /vinted} : le même moteur servira une
 * photo de bibliothèque, un lot acheté ailleurs ou un import de collection.
 * L'attacher à l'analyse d'achat aurait figé le premier usage dans l'URL.
 *
 * <h2>Ce que cette route ne fait pas</h2>
 * Elle n'écrit <b>rien</b>. Pas d'Ownership, pas de Wishlist, pas d'Entity, pas
 * d'Édition, pas de Tome. Elle rend des propositions à confirmer. C'est aussi
 * pourquoi elle est en POST malgré son absence d'effet : elle porte un corps
 * (des URL de photos) et déclenche un traitement coûteux, ce qu'un GET ne doit
 * pas faire.
 *
 * <h2>Toujours 200, sauf requête invalide</h2>
 * Aucun moteur configuré, moteur en panne, photos illisibles, rien reconnu :
 * ce sont des issues normales du parcours, distinguées par le champ
 * {@code status}. Même convention que {@code POST /listing-metadata/resolve} -
 * un bandeau rouge confondrait « ces photos ne montrent rien de lisible » avec
 * « le service est cassé ».
 */
@RestController
@RequestMapping("/api/image-recognition")
@Tag(name = "Image recognition", description = "Identifier des œuvres depuis des photos - propositions à confirmer")
public class ImageRecognitionController {

    private final ImageRecognitionService service;

    public ImageRecognitionController(ImageRecognitionService service) {
        this.service = service;
    }

    /**
     * @param imageUrls          les photos à analyser - uniquement des hôtes qu'un provider déclare
     * @param listingTitle       indice de lecture facultatif, jamais une réponse attendue
     * @param entityTypeCode     univers attendu (« MANGA ») - la V1 n'est validée que sur celui-là
     */
    public record AnalyzeImagesRequest(List<String> imageUrls, String listingTitle, String entityTypeCode) {
    }

    public record RecognizedItemResponse(String seriesTitle, String seriesTitleAsRead, Integer volumeNumber,
                                          String editionHint, boolean hasExactIdentifier,
                                          String confidence, List<String> evidence, List<Integer> sourceImages,
                                          String catalogStatus, UUID entityId,
                                          List<EditionOptionResponse> editionOptions,
                                          boolean preselected, boolean readyForAnalysis) {

        static RecognizedItemResponse from(ResolvedItem item) {
            return new RecognizedItemResponse(
                    item.displayTitle(),
                    // Ce qui a été lu, conservé à part : l'utilisateur doit pouvoir
                    // constater l'écart entre la photo et le catalogue.
                    item.recognized().seriesTitleRaw(),
                    item.recognized().volumeNumber(),
                    item.recognized().editionHint(),
                    item.recognized().hasExactIdentifier(),
                    item.recognized().confidence().name(),
                    item.recognized().evidence(),
                    List.copyOf(item.recognized().sourceImages()),
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
     * @param unidentifiedCount éléments vus mais non identifiés - à afficher, sinon
     *                          l'utilisateur croit le lot plus petit qu'il n'est
     * @param notInCatalogCount reconnus mais absents du catalogue : rien n'a été créé pour eux
     */
    public record AnalyzeImagesResponse(String status, List<RecognizedItemResponse> items,
                                         int unidentifiedCount, int notInCatalogCount,
                                         int analyzedImageCount, int requestedImageCount) {
    }

    @Operation(summary = "Analyser des photos et proposer les œuvres reconnues. Répond toujours 200 : le champ "
            + "status distingue succès, résultat partiel, rien reconnu, aucune photo exploitable, moteur non "
            + "configuré et moteur indisponible. N'écrit RIEN - ni possession, ni envie, ni fiche catalogue : "
            + "les éléments rendus sont des propositions que l'utilisateur confirme ou corrige.")
    @PostMapping("/analyze")
    public AnalyzeImagesResponse analyze(@RequestBody AnalyzeImagesRequest request) {
        if (request == null || request.imageUrls() == null || request.imageUrls().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Au moins une photo est requise");
        }
        if (request.imageUrls().size() > RecognitionImageFetcher.MAX_IMAGES) {
            // Borne dite explicitement plutôt que silencieusement tronquée :
            // l'appelant doit savoir que sa demande n'a pas été traitée en entier.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de photos : %d au maximum".formatted(RecognitionImageFetcher.MAX_IMAGES));
        }

        RecognitionContext context = new RecognitionContext(request.listingTitle(), request.entityTypeCode());
        ImageRecognitionService.Analysis analyse = service.analyze(request.imageUrls(), context);

        return new AnalyzeImagesResponse(
                analyse.status().name(),
                analyse.items().stream().map(RecognizedItemResponse::from).toList(),
                analyse.unidentifiedCount(),
                (int) analyse.items().stream()
                        .filter(item -> item.catalogStatus() == CatalogStatus.NOT_IN_CATALOG)
                        .count(),
                analyse.analyzedImageCount(),
                analyse.requestedImageCount());
    }
}
