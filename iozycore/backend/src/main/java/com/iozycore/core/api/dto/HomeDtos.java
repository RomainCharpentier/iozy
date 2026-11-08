package com.iozycore.core.api.dto;

import com.iozycore.core.domain.home.HomeWeek;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The home page "ta semaine" on the wire. The blocks keep the names of the page
 * (une, aussi, chiffre, presqueFini, rayons); each one may be empty
 * ({@code null} or an empty list). Every sentence is built by the client from
 * these fields: the server says why, the client says it in French.
 */
public final class HomeDtos {

    private HomeDtos() {
    }

    /** A work as a home block shows it. */
    public record HomeWorkResponse(UUID entityId, UUID entityTypeId, String title, String coverImageUrl,
                                   CollectorStatus collectorStatus, int ownedCount, Integer totalCount,
                                   int missingCount, int wishedCount, Instant lastMovedAt) {

        static HomeWorkResponse from(WorkView view) {
            return new HomeWorkResponse(view.entityId(), view.entityTypeId(), view.title(), view.coverImageUrl(),
                    view.collectorStatus(), view.ownedCount(), view.totalCount(), view.missingCount(),
                    view.wishedCount(), view.lastMovedAt());
        }
    }

    /**
     * @param date      "2026-11-13" or "2026-11"
     * @param precision DAY or MONTH
     * @param label     "Tome 15", empty when it is the work itself
     */
    public record HomeReleaseResponse(String date, String precision, String label, Integer number) {

        static HomeReleaseResponse from(HomeWeek.Release release) {
            return release == null ? null : new HomeReleaseResponse(release.date().iso(),
                    release.date().precision().name(), release.label(), release.number());
        }
    }

    /** One element of a work: a segment of the lead's gauge, or a missing element of "presque fini". */
    public record HomeElementResponse(String key, String label, Integer number, WorkElement.State state,
                                      boolean countedAsMissing, UUID variantId) {

        static HomeElementResponse from(WorkElement element, boolean countedAsMissing) {
            return new HomeElementResponse(element.key(), element.label(), element.number(), element.state(),
                    countedAsMissing, element.variantId());
        }
    }

    /**
     * @param reason      RELEASE (it comes out this week) or MOVED (the work that moved last)
     * @param release     the release this week, {@code null} for MOVED
     * @param nextRelease the next release of the work, or {@code null}
     * @param elements    every element of the work, in order: the gauge
     */
    public record HomeLeadResponse(HomeWorkResponse work, HomeWeek.Reason reason, HomeReleaseResponse release,
                                   HomeReleaseResponse nextRelease, List<HomeElementResponse> elements) {

        static HomeLeadResponse from(HomeWeek.Lead lead) {
            return lead == null ? null : new HomeLeadResponse(HomeWorkResponse.from(lead.work()), lead.reason(),
                    HomeReleaseResponse.from(lead.release()), HomeReleaseResponse.from(lead.nextRelease()),
                    lead.work().elements().stream()
                            .map(c -> HomeElementResponse.from(c.element(), c.countedAsMissing())).toList());
        }
    }

    /** @param release the release this week, {@code null} for MOVED */
    public record HomeItemResponse(HomeWorkResponse work, HomeWeek.Reason reason, HomeReleaseResponse release) {

        static HomeItemResponse from(HomeWeek.Item item) {
            return new HomeItemResponse(HomeWorkResponse.from(item.work()), item.reason(),
                    HomeReleaseResponse.from(item.release()));
        }
    }

    /** @param totalObjects the active copies: the big number */
    public record HomeFigureResponse(long totalObjects, long addedThisMonth, int releasesThisWeek) {

        static HomeFigureResponse from(HomeWeek.Figure figure) {
            return figure == null ? null
                    : new HomeFigureResponse(figure.totalObjects(), figure.addedThisMonth(), figure.releasesThisWeek());
        }
    }

    public record HomeAlmostDoneResponse(HomeWorkResponse work, List<HomeElementResponse> missing) {

        static HomeAlmostDoneResponse from(HomeWeek.AlmostDone almostDone) {
            return new HomeAlmostDoneResponse(HomeWorkResponse.from(almostDone.work()),
                    almostDone.missing().stream().map(e -> HomeElementResponse.from(e, true)).toList());
        }
    }

    public record HomeCoverResponse(UUID entityId, String title, String coverImageUrl) {
    }

    public record HomeShelfResponse(UUID entityTypeId, int workCount, long objectCount,
                                    List<HomeCoverResponse> covers) {

        static HomeShelfResponse from(HomeWeek.Shelf shelf) {
            return new HomeShelfResponse(shelf.entityTypeId(), shelf.workCount(), shelf.objectCount(),
                    shelf.covers().stream()
                            .map(w -> new HomeCoverResponse(w.entityId(), w.title(), w.coverImageUrl())).toList());
        }
    }

    /** @param weekStart the Monday of the week, "2026-11-02"; weekEnd its Sunday */
    public record HomeWeekResponse(String weekStart, String weekEnd, HomeLeadResponse une,
                                   List<HomeItemResponse> aussi, HomeFigureResponse chiffre,
                                   List<HomeAlmostDoneResponse> presqueFini, List<HomeShelfResponse> rayons) {

        public static HomeWeekResponse from(HomeWeek week) {
            return new HomeWeekResponse(week.weekStart().toString(), week.weekEnd().toString(),
                    HomeLeadResponse.from(week.lead()),
                    week.alsoThisWeek().stream().map(HomeItemResponse::from).toList(),
                    HomeFigureResponse.from(week.figure()),
                    week.almostDone().stream().map(HomeAlmostDoneResponse::from).toList(),
                    week.shelves().stream().map(HomeShelfResponse::from).toList());
        }
    }
}
