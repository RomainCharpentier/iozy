package com.iozycore.core.api.insights;

import com.iozycore.core.insights.CollectionValue;
import com.iozycore.core.insights.CollectionProgress;
import com.iozycore.core.insights.DiscoveryService;
import com.iozycore.core.insights.ReleaseCalendarService;
import com.iozycore.core.api.insights.ReleaseCalendarDtos.LastRunResponse;
import com.iozycore.core.api.insights.ReleaseCalendarDtos.LatestReleasesResponse;
import com.iozycore.core.api.insights.ReleaseCalendarDtos.ReleaseCalendarResponse;
import com.iozycore.core.api.insights.ReleaseCalendarDtos.ReleaseRefreshStatusResponse;
import com.iozycore.core.insights.ReleaseRefreshService;
import com.iozycore.core.insights.StatsService;
import com.iozycore.core.insights.StatsSummary;
import com.iozycore.core.insights.YearlyRecap;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import com.iozycore.core.insights.SeriesProgressGateway;

@RestController
@RequestMapping("/api/insights")
@Tag(name = "Insights", description = "UC6 - statistics and discovery (read only)")
public class InsightsController {

    private static final int MAX_LATEST = 50;

    private final StatsService statsService;
    private final DiscoveryService discoveryService;
    private final SeriesProgressGateway collectionProgressService;
    private final ReleaseCalendarService releaseCalendarService;
    private final ReleaseRefreshService releaseRefreshService;

    public InsightsController(StatsService statsService, DiscoveryService discoveryService,
                               SeriesProgressGateway collectionProgressService,
                               ReleaseCalendarService releaseCalendarService,
                               ReleaseRefreshService releaseRefreshService) {
        this.statsService = statsService;
        this.discoveryService = discoveryService;
        this.collectionProgressService = collectionProgressService;
        this.releaseCalendarService = releaseCalendarService;
        this.releaseRefreshService = releaseRefreshService;
    }

    @Operation(summary = "Aggregated statistics: number of entities/ownerships per type, "
            + "average rating, experiences of the current year, most used tags")
    @GetMapping("/stats")
    public StatsSummary stats() {
        return statsService.computeSummary();
    }

    @Operation(summary = "\"Automatic computation of the collection value\" (§15 V2): sum of the purchase prices "
            + "filled in on the currently owned ownerships, per type - never presented as the full real "
            + "value as long as not all ownerships have a price filled in")
    @GetMapping("/value")
    public CollectionValue value() {
        return statsService.computeCollectionValue();
    }

    @Operation(summary = "\"Evolution of my collection\": number of volumes/copies added per month, "
            + "from the oldest to the newest - counts only, no monetary value")
    @GetMapping("/timeline")
    public List<StatsSummary.MonthlyPoint> timeline() {
        return statsService.computeTimeline();
    }

    @Operation(summary = "\"Yearly review\": number of additions, series started, most present author/studio "
            + "for a given year (default: current year) - no public endpoint, to be downloaded as an image on the client side")
    @GetMapping("/yearly-recap")
    public YearlyRecap yearlyRecap(@RequestParam(required = false) Integer year) {
        return statsService.computeYearlyRecap(year != null ? year : LocalDate.now().getYear());
    }

    @Operation(summary = "Progress \"X volumes owned out of Y\" of each work - single source, "
            + "to be consumed rather than recomputed (see SeriesProgressGateway)")
    @GetMapping("/progress")
    public List<CollectionProgress> progress() {
        return collectionProgressService.computeAll();
    }

    @Operation(summary = "The same progress, for ONE work - what its detail page needs, "
            + "without downloading the one of the whole collection. 404 if the work does not exist.")
    @GetMapping("/progress/{entityId}")
    public CollectionProgress progress(@PathVariable UUID entityId) {
        return collectionProgressService.compute(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Œuvre inconnue : " + entityId));
    }

    @Operation(summary = "Heuristic discovery (no AI): mangas by the same author as your "
            + "best rated mangas, trending board games sharing categories with yours, "
            + "or video games similar to yours (IGDB). Expected entityTypeCode: MANGA, BOARD_GAME or VIDEO_GAME. "
            + "sourceAnswered is false when the external source did not answer; emptyReason says why "
            + "nothing was asked of it (NOTHING_OWNED, NO_RATED_WORK, NO_KNOWN_AUTHOR, NOT_LINKED_TO_SOURCE)")
    @GetMapping("/discover")
    public DiscoveryResponse discover(@RequestParam String entityTypeCode) {
        try {
            return DiscoveryResponse.from(discoveryService.discover(entityTypeCode));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "Release calendar: what comes out between two dates (included, one year at most) for "
            + "owned or wished works, all categories together - volumes dated by Google Books for "
            + "mangas, IGDB dates for video games, and the date typed on a detail page for any work. "
            + "Never an approximate date: a source that only knows the year puts nothing here. "
            + "400 on an unreadable date, a reversed period or one longer than a year.")
    @GetMapping("/releases")
    public ReleaseCalendarResponse releases(@RequestParam String from, @RequestParam String to) {
        try {
            return ReleaseCalendarResponse.from(releaseCalendarService.releasesBetween(parseDay(from, "from"), parseDay(to, "to")));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "The latest releases (dated to the day or to the month), future or past, newest "
            + "first - no period to give. `limit` is 10 by default, 50 at most. 400 outside 1..50.")
    @GetMapping("/releases/latest")
    public LatestReleasesResponse latestReleases(@RequestParam(defaultValue = "10") int limit) {
        if (limit < 1 || limit > MAX_LATEST) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nombre de sorties doit être entre 1 et " + MAX_LATEST);
        }
        return LatestReleasesResponse.from(releaseCalendarService.latest(limit));
    }

    @Operation(summary = "When the release dates were last refreshed (night job or manual launch), whether a "
            + "pass is running, and how many series are still waiting for a re-read")
    @GetMapping("/releases/refresh")
    public ReleaseRefreshStatusResponse refreshStatus() {
        return currentRefreshStatus();
    }

    @Operation(summary = "Starts a refresh of the release dates now, in the background, and answers 202 with the "
            + "status. 409 when a pass is already running or when nothing can be refreshed. "
            + "Closed to the visitor like every write.")
    @PostMapping("/releases/refresh")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ReleaseRefreshStatusResponse startRefresh() {
        if (!releaseRefreshService.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Aucune source de sorties à mettre à jour");
        }
        if (!releaseRefreshService.startManual()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Une mise à jour est déjà en cours");
        }
        return currentRefreshStatus();
    }

    private ReleaseRefreshStatusResponse currentRefreshStatus() {
        return new ReleaseRefreshStatusResponse(releaseRefreshService.isAvailable(), releaseRefreshService.isRunning(),
                releaseRefreshService.lastRun().map(LastRunResponse::from).orElse(null));
    }
    /** An ISO date to the day, without which the message names the parameter at fault rather than letting a 500 through. */
    private static LocalDate parseDay(String value, String parameter) {
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Le paramètre '" + parameter + "' attend une date AAAA-MM-JJ : " + value);
        }
    }
}
