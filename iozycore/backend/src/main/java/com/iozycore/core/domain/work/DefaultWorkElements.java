package com.iozycore.core.domain.work;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.wishlist.WishlistEntry;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * The elements of a work when no universe says otherwise - the rule a custom
 * type gets with nothing to write:
 * <ul>
 *   <li>a work with variants is made of its variants (each one owned, wished,
 *       announced or missing on its own);</li>
 *   <li>a work without variants is its own single element.</li>
 * </ul>
 * The total is then what the catalog lists: the variants, or one.
 *
 * <p>The universes reuse {@link #wholeWork} and {@link #ofVariant} for their own rules.
 */
public final class DefaultWorkElements {

    public static final String WHOLE_WORK_KEY = "work";
    private static final String VOLUME_NUMBER = "volumeNumber";
    private static final String RELEASE_DATE = "releaseDate";

    private DefaultWorkElements() {
    }

    public static List<WorkElements> of(WorkElementsContext context) {
        Map<UUID, List<Ownership>> ownerships = context.ownershipsByWork();
        Map<UUID, List<WishlistEntry>> wishes = context.wishesByWork();
        Map<UUID, List<ReleaseEntry>> releases = context.releasesByWork();
        List<WorkElements> result = new ArrayList<>();
        for (Entity work : context.works()) {
            List<Ownership> owned = ownerships.getOrDefault(work.id(), List.of());
            List<WishlistEntry> wished = wishes.getOrDefault(work.id(), List.of());
            List<ReleaseEntry> dated = releases.getOrDefault(work.id(), List.of());
            if (work.variants().isEmpty()) {
                result.add(new WorkElements(work.id(),
                        List.of(wholeWork(work, owned, wished, dated, context.today())), 1));
                continue;
            }
            List<WorkElement> elements = work.variants().stream()
                    .map(variant -> ofVariant(variant, owned, wished, context.today()))
                    .sorted(DISPLAY_ORDER)
                    .toList();
            result.add(new WorkElements(work.id(), elements, elements.size()));
        }
        return result;
    }

    /** Numbered elements first, by number; then by label. */
    public static final Comparator<WorkElement> DISPLAY_ORDER = Comparator
            .comparing((WorkElement element) -> element.number() == null ? Integer.MAX_VALUE : element.number())
            .thenComparing(element -> element.label().toLowerCase());

    /**
     * The work as one piece: owned when any active ownership of it exists, wanted
     * when it is in the wishes, announced when its release is ahead.
     */
    public static WorkElement wholeWork(Entity work, List<Ownership> activeOwnerships, List<WishlistEntry> wishes,
                                        List<ReleaseEntry> releases, LocalDate today) {
        Optional<Ownership> ownership = activeOwnerships.stream().findFirst();
        boolean wanted = wishes.stream().anyMatch(entry -> entry.variantId().isEmpty());
        ReleaseDate date = WorkElementsContext.earliestWholeWorkRelease(releases).map(ReleaseEntry::date)
                .or(() -> ReleaseDate.parse(work.attributes().get(RELEASE_DATE)))
                .orElse(null);
        return new WorkElement(WHOLE_WORK_KEY, work.title(), null, WorkElementsContext.coverOf(work.attributes()),
                WorkElement.stateOf(ownership.isPresent(), wanted, date, today), date, null,
                ownership.map(Ownership::id).orElse(null));
    }

    /** One variant of a work, with its own ownership, wish and release date. */
    public static WorkElement ofVariant(Variant variant, List<Ownership> activeOwnerships, List<WishlistEntry> wishes,
                                        LocalDate today) {
        Optional<Ownership> ownership = activeOwnerships.stream()
                .filter(o -> o.variantId().filter(variant.id()::equals).isPresent())
                .findFirst();
        boolean wanted = wishes.stream().anyMatch(w -> w.variantId().filter(variant.id()::equals).isPresent());
        ReleaseDate date = ReleaseDate.parse(variant.attributes().get(RELEASE_DATE)).orElse(null);
        return new WorkElement("variant-" + variant.id(), variant.label(), numberOf(variant.attributes()),
                WorkElementsContext.coverOf(variant.attributes()),
                WorkElement.stateOf(ownership.isPresent(), wanted, date, today), date, variant.id(),
                ownership.map(Ownership::id).orElse(null));
    }

    /** The attributes are an untyped bag: a number arrives as a number from one source, as text from another. */
    public static Integer numberOf(Map<String, Object> attributes) {
        Object value = attributes == null ? null : attributes.get(VOLUME_NUMBER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
