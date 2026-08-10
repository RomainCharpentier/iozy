package com.iozycore.api.insights;

import com.iozycore.insights.DiscoveryCandidate;
import com.iozycore.insights.DiscoveryService;
import com.iozycore.insights.StatsService;
import com.iozycore.insights.StatsSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/insights")
@Tag(name = "Insights", description = "UC6 - statistiques et découverte (lecture seule)")
public class InsightsController {

    private final StatsService statsService;
    private final DiscoveryService discoveryService;

    public InsightsController(StatsService statsService, DiscoveryService discoveryService) {
        this.statsService = statsService;
        this.discoveryService = discoveryService;
    }

    @Operation(summary = "Statistiques agrégées : nombre d'entités/possessions par type, "
            + "note moyenne, expériences de l'année en cours, tags les plus utilisés")
    @GetMapping("/stats")
    public StatsSummary stats() {
        return statsService.computeSummary();
    }

    @Operation(summary = "\"Évolution de ma collection\" : nombre de tomes/exemplaires ajoutés par mois, "
            + "du plus ancien au plus récent - comptages uniquement, aucune valeur monétaire")
    @GetMapping("/timeline")
    public List<StatsSummary.MonthlyPoint> timeline() {
        return statsService.computeTimeline();
    }

    @Operation(summary = "Découverte heuristique (pas d'IA) : mangas du même auteur que tes mangas "
            + "les mieux notés, jeux de société tendance partageant des catégories avec les tiens, "
            + "ou jeux vidéo similaires aux tiens (IGDB). entityTypeCode attendu : MANGA, BOARD_GAME ou VIDEO_GAME")
    @GetMapping("/discover")
    public List<DiscoveryCandidate> discover(@RequestParam String entityTypeCode) {
        return switch (entityTypeCode) {
            case "MANGA" -> discoveryService.discoverManga();
            case "BOARD_GAME" -> discoveryService.discoverBoardGames();
            case "VIDEO_GAME" -> discoveryService.discoverVideoGames();
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "entityTypeCode doit être MANGA, BOARD_GAME ou VIDEO_GAME");
        };
    }
}
