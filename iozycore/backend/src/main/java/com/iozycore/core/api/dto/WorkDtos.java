package com.iozycore.core.api.dto;

import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.work.CollectionSummary;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElementsOrigin;
import com.iozycore.core.domain.work.WorkView;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** The works read model on the wire: one work with its elements, the list, the summary. */
public final class WorkDtos {

    private WorkDtos() {
    }

    /**
     * One element of a work.
     *
     * @param releaseDate      "2026-10-14", "2026-10" (known to the month), or {@code null}
     * @param countedAsMissing true when it counts in {@code missingCount}: lacking, published, and the work is ONGOING
     * @param optional         a derived element the collector does not follow yet (an expansion, another game of
     *                         the licence): listed, never counted as missing
     * @param linkedEntityId   the other work behind the element (a game of the licence), or {@code null}
     */
    public record WorkElementResponse(String key, String label, Integer number, String coverImageUrl,
                                      WorkElement.State state, String releaseDate, UUID variantId,
                                      UUID ownershipId, boolean countedAsMissing, boolean optional,
                                      UUID linkedEntityId) {

        static WorkElementResponse from(WorkView.CountedElement counted) {
            WorkElement element = counted.element();
            return new WorkElementResponse(element.key(), element.label(), element.number(),
                    element.coverImageUrl(), element.state(),
                    element.releaseDate() == null ? null : element.releaseDate().iso(), element.variantId(),
                    element.ownershipId(), counted.countedAsMissing(), element.optional(),
                    element.linkedEntityId());
        }
    }

    /**
     * Where the derived elements of a work come from.
     *
     * @param provider  "BGG" or "IGDB"
     * @param fallback  true when the provider could not be used: the elements are the catalog's only
     * @param note      why, in French for the collector, or {@code null}
     * @param groupName the licence, or {@code null}
     * @param scope     the console the elements are limited to, or {@code null}
     */
    public record ElementsSourceResponse(String provider, boolean fallback, String note, String groupName,
                                         String scope) {

        static ElementsSourceResponse from(WorkElementsOrigin origin) {
            return origin == null ? null : new ElementsSourceResponse(origin.provider(), origin.fallback(),
                    origin.note(), origin.groupName(), origin.scope());
        }
    }

    /**
     * The next release of a work.
     *
     * @param date      "2026-10-14" or "2026-10"
     * @param precision DAY or MONTH
     * @param label     what comes out ("Tome 12 · Kana"), empty when it is the work itself
     * @param price     not known by any source yet: always {@code null} for now
     */
    public record NextReleaseResponse(String date, String precision, String label, Integer volumeNumber,
                                      BigDecimal price) {

        static NextReleaseResponse from(ReleaseEntry entry) {
            return entry == null ? null : new NextReleaseResponse(entry.date().iso(),
                    entry.date().precision().name(), entry.label(), entry.volumeNumber(), null);
        }
    }

    public record WorkResponse(UUID entityId, UUID entityTypeId, String title, String coverImageUrl,
                               CollectorStatus collectorStatus, int ownedCount, Integer totalCount,
                               int missingCount, boolean totalKnown, List<WorkElementResponse> elements,
                               NextReleaseResponse nextRelease, Instant lastMovedAt,
                               ElementsSourceResponse elementsSource) {

        public static WorkResponse from(WorkView view) {
            return new WorkResponse(view.entityId(), view.entityTypeId(), view.title(), view.coverImageUrl(),
                    view.collectorStatus(), view.ownedCount(), view.totalCount(), view.missingCount(),
                    view.totalKnown(), view.elements().stream().map(WorkElementResponse::from).toList(),
                    NextReleaseResponse.from(view.nextRelease()), view.lastMovedAt(),
                    ElementsSourceResponse.from(view.elementsOrigin()));
        }
    }

    /** @param nextReleaseDate "2026-10-14", "2026-10", or {@code null} */
    public record WorkProgressResponse(UUID entityId, UUID entityTypeId, String title, String coverImageUrl,
                                       CollectorStatus collectorStatus, int ownedCount, Integer totalCount,
                                       int missingCount, int wishedCount, String nextReleaseDate,
                                       Instant lastMovedAt) {

        public static WorkProgressResponse from(WorkView view) {
            return new WorkProgressResponse(view.entityId(), view.entityTypeId(), view.title(),
                    view.coverImageUrl(), view.collectorStatus(), view.ownedCount(), view.totalCount(),
                    view.missingCount(), view.wishedCount(),
                    view.nextRelease() == null ? null : view.nextRelease().date().iso(), view.lastMovedAt());
        }
    }

    public record CollectorStatusRequest(CollectorStatus status) {
    }

    public record CollectorStatusResponse(UUID entityId, CollectorStatus collectorStatus) {
    }

    public record TypeCountResponse(UUID entityTypeId, long count) {

        static TypeCountResponse from(CollectionSummary.TypeCount count) {
            return new TypeCountResponse(count.entityTypeId(), count.count());
        }
    }

    public record CollectionSummaryResponse(long totalObjects, long addedThisMonth,
                                            List<TypeCountResponse> addedThisMonthByType,
                                            List<TypeCountResponse> byType) {

        public static CollectionSummaryResponse from(CollectionSummary summary) {
            return new CollectionSummaryResponse(summary.totalObjects(), summary.addedThisMonth(),
                    summary.addedThisMonthByType().stream().map(TypeCountResponse::from).toList(),
                    summary.byType().stream().map(TypeCountResponse::from).toList());
        }
    }
}
