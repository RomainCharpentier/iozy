package com.iozycore.api.recognition;

import com.iozycore.recognition.CatalogStatus;
import com.iozycore.recognition.ListingRecognitionService;
import com.iozycore.recognition.RecognitionContext;
import com.iozycore.recognition.RecognitionImage;
import com.iozycore.recognition.RecognitionImageLimits;
import com.iozycore.recognition.RecognitionSource;
import com.iozycore.recognition.ResolvedItem;
import com.iozycore.recognition.UploadedImageReader;
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
 * Propose ce qu'une annonce contient probablement, à partir de son texte et,
 * si on le demande, de ses photos.
 *
 * <h2>Une route, deux usages, un seul coût quand il le faut</h2>
 * {@code imageUrls} est <b>facultatif</b>, et c'est tout le mécanisme :
 * <ul>
 *   <li><b>sans</b> photos : seul le texte est lu, localement. <b>Aucun moteur
 *       n'est appelé</b>, aucune image n'est téléchargée. C'est l'appel fait
 *       automatiquement quand une annonce vient d'être récupérée ;</li>
 *   <li><b>avec</b> photos : le texte est relu et les photos sont analysées,
 *       puis tout est consolidé ensemble. C'est l'appel fait sur le clic
 *       « Analyser les photos ».</li>
 * </ul>
 * La présence des photos dans le corps <b>est</b> le consentement. Il n'existe
 * aucun chemin par lequel charger une annonce déclenche un appel payant.
 *
 * <h2>Une seule consolidation, côté domaine</h2>
 * Le client n'assemble jamais deux listes : il envoie ce qu'il a et reçoit
 * <b>une</b> liste. Les règles de fusion (même série + même tome, éditions
 * compatibles, photos multiples) vivent dans
 * {@code RecognitionConsolidator} et nulle part ailleurs - surtout pas
 * réécrites en TypeScript.
 *
 * <h2>Ce que cette route ne fait pas</h2>
 * Elle n'écrit <b>rien</b>. Pas d'Ownership, pas de Wishlist, pas d'Entity,
 * pas d'Édition, pas de Tome. Elle rend des propositions à confirmer. C'est
 * aussi pourquoi elle est en POST malgré son absence d'effet : elle porte un
 * corps et déclenche un traitement, ce qu'un GET ne doit pas faire.
 *
 * <h2>Toujours 200, sauf requête invalide</h2>
 * Rien reconnu, moteur en panne, photos illisibles, aucun moteur configuré :
 * issues normales du parcours, distinguées par {@code visionStatus}. Un
 * bandeau rouge confondrait « ces photos ne montrent rien de lisible » avec
 * « le service est cassé ».
 */
@RestController
@RequestMapping("/api/recognition")
@Tag(name = "Recognition", description = "Détecter les éléments d'une annonce depuis son texte et ses photos")
public class RecognitionController {

    private final ListingRecognitionService service;
    private final UploadedImageReader uploadedImageReader;

    public RecognitionController(ListingRecognitionService service, UploadedImageReader uploadedImageReader) {
        this.service = service;
        this.uploadedImageReader = uploadedImageReader;
    }

    /**
     * @param title       titre de l'annonce - lu localement, jamais transmis à un moteur externe
     * @param description description de l'annonce - idem
     * @param imageUrls   photos à analyser. <b>Absent ou vide = analyse du texte seul</b>,
     *                    donc aucun appel de moteur
     * @param entityTypeCode univers attendu (« MANGA ») - la V1 n'est validée que sur celui-là
     */
    public record AnalyzeListingRequest(String title, String description, List<String> imageUrls,
                                         String entityTypeCode) {
    }

    public record RecognizedItemResponse(String seriesTitle, String seriesTitleAsRead, Integer volumeNumber,
                                          String editionHint, boolean hasExactIdentifier,
                                          String confidence, List<String> sources, List<String> sourceLabels,
                                          List<String> evidence, List<Integer> sourceImages,
                                          String catalogStatus, UUID entityId,
                                          List<EditionOptionResponse> editionOptions,
                                          boolean preselected, boolean readyForAnalysis) {

        static RecognizedItemResponse from(ResolvedItem item) {
            List<RecognitionSource> sources = item.recognized().sources().stream()
                    .sorted(java.util.Comparator.comparingInt(RecognitionSource::priority).reversed())
                    .toList();
            return new RecognizedItemResponse(
                    item.displayTitle(),
                    // Ce qui a été lu, conservé à part : l'utilisateur doit pouvoir
                    // constater l'écart entre l'annonce et le catalogue.
                    item.recognized().seriesTitleRaw(),
                    item.recognized().volumeNumber(),
                    item.recognized().editionHint(),
                    item.recognized().hasExactIdentifier(),
                    item.recognized().confidence().name(),
                    sources.stream().map(Enum::name).toList(),
                    // Le libellé parle de la donnée (« annonce », « photos »),
                    // jamais du fournisseur d'IA.
                    sources.stream().map(RecognitionSource::label).toList(),
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
     * @param visionStatus  {@code null} quand aucune photo n'a été demandée - à ne pas
     *                      confondre avec un échec de lecture
     * @param textItemCount ce que le seul texte a produit : permet de dire « l'annonce
     *                      en décrit déjà N » avant toute analyse d'image
     * @param unidentifiedCount éléments vus mais non identifiés - à afficher, sinon
     *                      l'utilisateur croit le lot plus petit qu'il n'est
     */
    public record AnalyzeListingResponse(String visionStatus, List<RecognizedItemResponse> items,
                                          int unidentifiedCount, int notInCatalogCount, int textItemCount,
                                          int analyzedImageCount, int requestedImageCount) {
    }

    @Operation(summary = "Détecter les éléments d'une annonce. Le titre et la description sont TOUJOURS lus, "
            + "localement et sans coût. Les photos ne sont analysées que si imageUrls est fourni - c'est le "
            + "seul déclencheur d'un appel de moteur. Répond toujours 200 : visionStatus distingue succès, "
            + "résultat partiel, rien reconnu, aucune photo exploitable, moteur non configuré et moteur "
            + "indisponible ; il vaut null quand aucune photo n'a été demandée. N'écrit RIEN - ni possession, "
            + "ni envie, ni fiche catalogue.")
    @PostMapping("/analyze")
    public AnalyzeListingResponse analyze(@RequestBody AnalyzeListingRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un corps de requête est attendu");
        }
        boolean texteVide = (request.title() == null || request.title().isBlank())
                && (request.description() == null || request.description().isBlank());
        boolean sansPhoto = request.imageUrls() == null || request.imageUrls().isEmpty();
        if (texteVide && sansPhoto) {
            // Ni texte ni photo : il n'y a littéralement rien à analyser.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Un titre, une description ou au moins une photo est requis");
        }
        if (!sansPhoto && request.imageUrls().size() > RecognitionImageLimits.MAX_IMAGES) {
            // Borne dite explicitement plutôt que silencieusement tronquée :
            // l'appelant doit savoir que sa demande n'a pas été traitée en entier.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de photos : %d au maximum".formatted(RecognitionImageLimits.MAX_IMAGES));
        }

        ListingRecognitionService.Analysis analyse = service.analyze(
                request.title(), request.description(), request.imageUrls(),
                new RecognitionContext(request.entityTypeCode()));

        return repondre(analyse);
    }

    /**
     * Analyse des photos <b>envoyées par l'utilisateur</b>, plutôt que
     * récupérées d'une annonce.
     *
     * <h2>Ce que cette route débloque</h2>
     * Le moteur de vision n'avait qu'une porte : des URLs sur des hôtes en
     * liste blanche. IozyCore était donc aveugle dès que les photos n'étaient
     * pas joignables - une plateforme qui refuse les robots, une annonce dont
     * le texte ne nomme aucune série, une étagère photographiée chez soi.
     * Dans tous ces cas l'utilisateur a les images ; il lui manquait le moyen
     * de les donner.
     *
     * <h2>Multipart, pas du base64 dans le JSON</h2>
     * Encoder trois photos en base64 les gonflerait d'un tiers et ferait
     * transiter 16 Mo de chaîne de caractères dans un corps JSON, à parser
     * d'un bloc en mémoire. Le multipart se lit en flux et se borne en cours
     * de lecture.
     *
     * <h2>Envoyer, c'est consentir</h2>
     * Comme pour {@code imageUrls}, la présence de photos <b>est</b> le
     * déclencheur : aucun chemin ne fait partir d'image sans un geste explicite.
     *
     * @param photos      les images ; huit au maximum, 3 Mo chacune. Le type est
     *                    constaté sur les octets, pas sur l'en-tête déclaré
     * @param title       titre saisi - lu localement, jamais transmis à un moteur
     * @param description description saisie - idem
     */
    @Operation(summary = "Détecter les éléments d'un lot à partir de photos ENVOYÉES par l'utilisateur. "
            + "Sert quand les photos ne sont pas récupérables : plateforme qui refuse la lecture "
            + "automatique, annonce sans texte exploitable, ou simple photo d'étagère. Aucune URL n'est "
            + "reçue ni jointe. Le titre et la description restent facultatifs et lus localement. "
            + "Répond toujours 200 sauf requête invalide, avec le même visionStatus que /analyze. "
            + "N'écrit RIEN.")
    @PostMapping(value = "/analyze-photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AnalyzeListingResponse analyzeUploadedPhotos(
            @RequestPart("photos") List<MultipartFile> photos,
            // @RequestParam et non @RequestPart : sur une String, @RequestPart
            // exige un Content-Type sur la partie, que le FormData d'un
            // navigateur ne pose pas - la requête échouerait en 415.
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "entityTypeCode", required = false) String entityTypeCode) {

        if (photos == null || photos.isEmpty() || photos.stream().allMatch(MultipartFile::isEmpty)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Au moins une photo est requise");
        }
        if (photos.size() > RecognitionImageLimits.MAX_IMAGES) {
            // Dit plutôt que tronqué en silence : l'appelant doit savoir que sa
            // demande n'a pas été traitée en entier.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trop de photos : %d au maximum".formatted(RecognitionImageLimits.MAX_IMAGES));
        }

        UploadedImageReader.Intake intake = uploadedImageReader.read(photos);
        List<RecognitionImage> images = intake.images();

        // requestedImageCount reste le nombre ENVOYÉ : c'est l'écart avec
        // analyzedImageCount qui permet de dire « 2 photos sur 5 étaient
        // illisibles » plutôt que de faire disparaître les trois autres.
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
                analyse.requestedImageCount());
    }
}
