package com.iozycore.core.api.insights;

import com.iozycore.core.insights.CollectionValue;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.insights.CollectionProgress;
import com.iozycore.core.insights.DiscoveryService;
import com.iozycore.core.insights.ReleaseCalendarService;
import com.iozycore.core.api.insights.ReleaseCalendarDtos.ReleaseCalendarResponse;
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
import java.time.format.DateTimeParseException;
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
    private final ReleaseCalendarService releaseCalendarService;

    public InsightsController(StatsService statsService, DiscoveryService discoveryService,
                               SeriesProgressGateway collectionProgressService,
                               ReleaseCalendarService releaseCalendarService) {
        this.statsService = statsService;
        this.discoveryService = discoveryService;
        this.collectionProgressService = collectionProgressService;
        this.releaseCalendarService = releaseCalendarService;
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

    @Operation(summary = "Calendrier des sorties : ce qui sort entre deux dates (incluses, un an au plus) pour les "
            + "œuvres possédées ou en envie, toutes catégories confondues - tomes datés par Google Books pour les "
            + "mangas, dates IGDB pour les jeux vidéo, et la date saisie sur une fiche pour n'importe quelle œuvre. "
            + "Jamais une date approximative : une source qui ne connaît que l'année ne met rien ici. "
            + "400 sur une date illisible, une période à l'envers ou plus longue qu'un an.")
    @GetMapping("/releases")
    public ReleaseCalendarResponse releases(@RequestParam String from, @RequestParam String to) {
        try {
            return ReleaseCalendarResponse.from(releaseCalendarService.releasesBetween(parseDay(from, "from"), parseDay(to, "to")));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** Une date ISO au jour près, sans quoi le message nomme le paramètre en cause plutôt que de laisser passer un 500. */
    private static LocalDate parseDay(String value, String parameter) {
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Le paramètre '" + parameter + "' attend une date AAAA-MM-JJ : " + value);
        }
    }
}
