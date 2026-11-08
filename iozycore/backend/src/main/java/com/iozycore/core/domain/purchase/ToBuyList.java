package com.iozycore.core.domain.purchase;

import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * The one list of what to buy (lot 216), for every type, read from the works
 * of the collector (lot 209).
 *
 * <h2>What enters</h2>
 * <ul>
 *   <li>an element announced and not out yet, of an ongoing work, or wished:
 *       one line per element ({@link ToBuyLine.Kind#UPCOMING});</li>
 *   <li>the counted missing elements of an ongoing work: one line per work,
 *       grouping them ({@link ToBuyLine.Kind#COMPLETE}, or
 *       {@link ToBuyLine.Kind#WISH} when every one of them is wished);</li>
 *   <li>the wished elements of a paused or dropped work: the wish is the
 *       collector's word, it stays even when the work no longer counts.</li>
 * </ul>
 * A paused or dropped work brings nothing else: its missing elements are not
 * counted, so they are not on the list either.
 *
 * <h2>Order</h2>
 * The soonest release first; then the work closest to complete (the fewest
 * elements left); then the title.
 */
public final class ToBuyList {

    private ToBuyList() {
    }

    public static final Comparator<ToBuyLine> ORDER = Comparator
            .comparing(ToBuyLine::releaseDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparingInt(line -> line.elements().size())
            .thenComparing(line -> line.title().toLowerCase());

    public static List<ToBuyLine> of(List<WorkView> works, LocalDate today) {
        List<ToBuyLine> lines = new ArrayList<>();
        for (WorkView work : works) {
            boolean ongoing = work.collectorStatus() == CollectorStatus.ONGOING;
            List<WorkElement> lacking = new ArrayList<>();
            for (WorkView.CountedElement counted : work.elements()) {
                WorkElement element = counted.element();
                if (element.state() == WorkElement.State.OWNED) {
                    continue;
                }
                boolean wanted = element.state() == WorkElement.State.WANTED;
                if (WorkElement.isUpcoming(element.releaseDate(), today)) {
                    if (ongoing || wanted) {
                        lines.add(line(work, ToBuyLine.Kind.UPCOMING, List.of(element), element));
                    }
                } else if (counted.countedAsMissing() || wanted) {
                    lacking.add(element);
                }
            }
            if (!lacking.isEmpty()) {
                boolean onlyWishes = lacking.stream().allMatch(e -> e.state() == WorkElement.State.WANTED);
                lines.add(line(work, onlyWishes ? ToBuyLine.Kind.WISH : ToBuyLine.Kind.COMPLETE, lacking, null));
            }
        }
        lines.sort(ORDER);
        return lines;
    }

    private static ToBuyLine line(WorkView work, ToBuyLine.Kind kind, List<WorkElement> elements,
                                  WorkElement dated) {
        return new ToBuyLine(work.entityId(), work.entityTypeId(), work.title(), work.coverImageUrl(), kind,
                work.collectorStatus(), elements, dated == null ? null : dated.releaseDate());
    }
}
