package com.iozycore.core.api.insights;

import com.iozycore.core.insights.CollectionValue;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.insights.CollectionProgress;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.http.ResponseEntity;
import com.iozycore.core.insights.CollectionQuestionService;
import com.iozycore.core.insights.CollectionAnswer;
import com.iozycore.core.insights.DiscoveryService;
import com.iozycore.core.insights.StatsService;
import com.iozycore.core.insights.StatsSummary;
import com.iozycore.core.insights.YearlyRecap;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.iozycore.core.insights.SeriesProgressGateway;

@RestController
@RequestMapping("/api/insights")
@Tag(name = "Insights", description = "UC6 - statistiques et découverte (lecture seule)")
public class InsightsController {

    private final StatsService statsService;
    private final DiscoveryService discoveryService;
    private final SeriesProgressGateway collectionProgressService;
    private final CollectionQuestionService collectionQuestionService;

    public InsightsController(StatsService statsService, DiscoveryService discoveryService,
                               SeriesProgressGateway collectionProgressService,
                               CollectionQuestionService collectionQuestionService) {
        this.statsService = statsService;
        this.discoveryService = discoveryService;
        this.collectionProgressService = collectionProgressService;
        this.collectionQuestionService = collectionQuestionService;
    }

    public record QuestionRequest(String question) {
    }

    /**
     * 204 quand aucune cle IA n'est configuree (la fonctionnalite n'existe
     * pas sur cette instance), 503 quand le modele n'a pas repondu : ni l'un
     * ni l'autre n'est une reponse vide a afficher comme venant de la
     * collection.
     */
    @Operation(summary = "Poser une question en francais sur sa collection - repondue par une IA a partir d'un "
            + "instantane des oeuvres, exemplaires, experiences et envies du compte ; jamais persistee. "
            + "204 sans cle Gemini, 503 si le modele n'a pas repondu")
    @PostMapping("/question")
    public ResponseEntity<CollectionAnswer> question(@RequestBody QuestionRequest request) {
        if (!collectionQuestionService.estDisponible()) {
            return ResponseEntity.noContent().build();
        }
        return collectionQuestionService.repondre(request == null ? null : request.question())
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "L'IA n'a pas répondu, réessaie dans un instant"));
    }

    @Operation(summary = "Statistiques agrégées : nombre d'entités/possessions par type, "
            + "note moyenne, expériences de l'année en cours, tags les plus utilisés")
    @GetMapping("/stats")
    public StatsSummary stats() {
        return statsService.computeSummary();
    }

    @Operation(summary = "\"Calcul automatique de la valeur de la collection\" (§15 V2) : somme des prix d'achat "
            + "renseignés sur les possessions actuellement possédées, par type - jamais présentée comme la valeur "
            + "réelle complète tant que toutes les possessions n'ont pas un prix renseigné")
    @GetMapping("/value")
    public CollectionValue value() {
        return statsService.computeCollectionValue();
    }

    @Operation(summary = "\"Évolution de ma collection\" : nombre de tomes/exemplaires ajoutés par mois, "
            + "du plus ancien au plus récent - comptages uniquement, aucune valeur monétaire")
    @GetMapping("/timeline")
    public List<StatsSummary.MonthlyPoint> timeline() {
        return statsService.computeTimeline();
    }

    @Operation(summary = "\"Bilan annuel\" : nombre d'ajouts, séries commencées, auteur/studio le plus présent "
            + "pour une année donnée (défaut : année en cours) - pas d'endpoint public, à télécharger en image côté client")
    @GetMapping("/yearly-recap")
    public YearlyRecap yearlyRecap(@RequestParam(required = false) Integer year) {
        return statsService.computeYearlyRecap(year != null ? year : LocalDate.now().getYear());
    }

    @Operation(summary = "Progression \"X tomes possédés sur Y\" de chaque œuvre - source unique, "
            + "à consommer plutôt qu'à recalculer (voir SeriesProgressGateway)")
    @GetMapping("/progress")
    public List<CollectionProgress> progress() {
        return collectionProgressService.computeAll();
    }

    @Operation(summary = "La même progression, pour UNE œuvre - ce dont a besoin sa fiche, "
            + "sans télécharger celle de toute la collection. 404 si l'œuvre n'existe pas.")
    @GetMapping("/progress/{entityId}")
    public CollectionProgress progress(@PathVariable UUID entityId) {
        return collectionProgressService.compute(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Œuvre inconnue : " + entityId));
    }

    @Operation(summary = "Découverte heuristique (pas d'IA) : mangas du même auteur que tes mangas "
            + "les mieux notés, jeux de société tendance partageant des catégories avec les tiens, "
            + "ou jeux vidéo similaires aux tiens (IGDB). entityTypeCode attendu : MANGA, BOARD_GAME ou VIDEO_GAME")
    @GetMapping("/discover")
    public List<DiscoveryCandidate> discover(@RequestParam String entityTypeCode) {
        try {
            return discoveryService.discover(entityTypeCode);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}
