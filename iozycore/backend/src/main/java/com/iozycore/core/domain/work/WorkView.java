package com.iozycore.core.domain.work;

import com.iozycore.core.domain.insights.ReleaseEntry;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * A work as the collector sees it: its elements and the counts the screens
 * show. The single place where "owned", "missing" and "wished" are counted,
 * whatever the type.
 *
 * <ul>
 *   <li><b>owned</b>: elements in the collection;</li>
 *   <li><b>missing</b>: elements published and not owned (missing or wanted, release not ahead),
 *       counted only while the work is ONGOING - a paused or dropped work still lists them,
 *       flagged as not counted;</li>
 *   <li><b>wished</b>: the wishes of the account on the work (whole work or element);</li>
 *   <li><b>total</b>: from the universe, {@code null} when unknown - never guessed.</li>
 * </ul>
 * An optional element (an expansion, another game of the licence the collector does not follow) is
 * listed and part of the total, but never counted as missing.
 *
 * @param elementsOrigin where the derived elements come from, or {@code null} (see {@link WorkElementsOrigin})
 */
public record WorkView(UUID entityId, UUID entityTypeId, String title, String coverImageUrl,
                       CollectorStatus collectorStatus, int ownedCount, Integer totalCount, int missingCount,
                       int wishedCount, List<CountedElement> elements, ReleaseEntry nextRelease, Instant lastMovedAt,
                       WorkElementsOrigin elementsOrigin) {

    /** An element and whether it counts in the missing total. */
    public record CountedElement(WorkElement element, boolean countedAsMissing) {
    }

    public WorkView {
        elements = List.copyOf(elements);
    }

    public boolean totalKnown() {
        return totalCount != null;
    }

    public static WorkView of(UUID entityId, UUID entityTypeId, String title, String coverImageUrl,
                              WorkElements workElements, CollectorStatus status, int wishedCount,
                              ReleaseEntry nextRelease, Instant lastMovedAt, LocalDate today) {
        CollectorStatus effective = status == null ? CollectorStatus.ONGOING : status;
        List<CountedElement> counted = workElements.elements().stream()
                .map(element -> new CountedElement(element,
                        effective.countsMissing() && element.isLacking(today)))
                .toList();
        int owned = (int) counted.stream().filter(c -> c.element().state() == WorkElement.State.OWNED).count();
        int missing = (int) counted.stream().filter(CountedElement::countedAsMissing).count();
        return new WorkView(entityId, entityTypeId, title, coverImageUrl, effective, owned,
                workElements.totalCount(), missing, wishedCount, counted, nextRelease, lastMovedAt,
                workElements.origin());
    }
}
