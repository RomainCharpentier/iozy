package com.iozycore.manga;

import com.iozycore.core.application.work.WorkElementsSource;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.insights.CollectionProgress;
import com.iozycore.core.domain.insights.CollectionProgress.EditionProgress;
import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.work.DefaultWorkElements;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import com.iozycore.manga.insights.CollectionProgressService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The elements of a manga series: its volumes, in ONE edition - the facade of
 * the manga module towards the works read model of the core.
 *
 * <h2>Which edition</h2>
 * The followed edition when there is one; otherwise the one with the most owned
 * volumes; otherwise the fullest one in the catalog (the order of
 * {@link CollectionProgressService}).
 *
 * <h2>Which volumes</h2>
 * From 1 to the highest number known: the total of the edition
 * ({@code manga_edition.total_volumes}), a catalogued or owned volume, or an
 * announced one. A number in that range that nobody catalogued is a known gap:
 * published (a later volume exists) and not owned. When the total is not filled
 * in, it stays unknown: the series counts what it can see, nothing more.
 *
 * <h2>The state of a volume</h2>
 * Owned (an active ownership), wanted (a wish on that volume), announced (its
 * release is ahead, from the stored volume search) or missing.
 */
@Component
@RequiredArgsConstructor
public class MangaWorkElements implements WorkElementsSource {

    /** A number beyond this is a typing slip (a year typed as a volume): its gaps are not filled. */
    static final int MAX_FILLED_VOLUMES = 500;

    private final CollectionProgressService progressService;
    private final FollowedEditionRepository followedEditionRepository;

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<WorkElements> elementsOf(WorkElementsContext context) {
        if (context.works().isEmpty()) {
            return List.of();
        }
        Map<UUID, CollectionProgress> progressByWork = progressService
                .computeFor(context.works(), context.activeOwnerships()).stream()
                .collect(Collectors.toMap(CollectionProgress::entityId, Function.identity(), (a, b) -> a));
        Map<UUID, String> followedByWork = followedEditionRepository
                .findByEntityIdIn(context.works().stream().map(Entity::id).toList()).stream()
                .collect(Collectors.toMap(FollowedEdition::entityId, FollowedEdition::editionName, (a, b) -> a));
        Map<UUID, List<Ownership>> ownerships = context.ownershipsByWork();
        Map<UUID, List<WishlistEntry>> wishes = context.wishesByWork();
        Map<UUID, List<ReleaseEntry>> releases = context.releasesByWork();

        List<WorkElements> result = new ArrayList<>();
        for (Entity series : context.works()) {
            Optional<EditionProgress> edition = Optional.ofNullable(progressByWork.get(series.id()))
                    .flatMap(progress -> chosenEdition(progress, followedByWork.get(series.id())));
            result.add(volumesOf(series, edition.orElse(null),
                    ownerships.getOrDefault(series.id(), List.of()),
                    wishes.getOrDefault(series.id(), List.of()),
                    releases.getOrDefault(series.id(), List.of()), context.today()));
        }
        return result;
    }

    static Optional<EditionProgress> chosenEdition(CollectionProgress progress, String followedEdition) {
        List<EditionProgress> editions = progress.editions();
        if (editions.isEmpty()) {
            return Optional.empty();
        }
        if (followedEdition != null && !followedEdition.isBlank()) {
            String followed = TexteRecherche.normaliser(followedEdition);
            Optional<EditionProgress> match = editions.stream()
                    .filter(e -> TexteRecherche.normaliser(e.editionName()).equals(followed))
                    .findFirst();
            if (match.isPresent()) {
                return match;
            }
        }
        // The list comes fullest first: on equal owned counts, the fullest edition wins.
        EditionProgress best = editions.get(0);
        for (EditionProgress candidate : editions) {
            if (candidate.ownedCount() > best.ownedCount()) {
                best = candidate;
            }
        }
        return Optional.of(best);
    }

    private static WorkElements volumesOf(Entity series, EditionProgress edition, List<Ownership> activeOwnerships,
                                          List<WishlistEntry> wishes, List<ReleaseEntry> releases, LocalDate today) {
        List<String> sourceEditions = edition == null ? List.of() : edition.sourceEditions();
        String editionName = edition == null ? "" : TexteRecherche.normaliser(edition.editionName());
        Integer total = edition == null ? null : edition.totalVolumes();

        Map<Integer, Variant> variantByNumber = new HashMap<>();
        for (Variant variant : series.variants()) {
            Integer number = DefaultWorkElements.numberOf(variant.attributes());
            if (number != null && sourceEditions.contains(editionOf(variant))) {
                variantByNumber.putIfAbsent(number, variant);
            }
        }
        Map<Integer, ReleaseEntry> releaseByNumber = new HashMap<>();
        for (ReleaseEntry entry : releases) {
            if (entry.volumeNumber() == null) {
                continue;
            }
            boolean sameEdition = editionName.isEmpty()
                    || TexteRecherche.normaliser(entry.editionName() == null ? "" : entry.editionName())
                    .equals(editionName);
            if (sameEdition) {
                releaseByNumber.merge(entry.volumeNumber(), entry,
                        (a, b) -> a.date().compareTo(b.date()) <= 0 ? a : b);
            }
        }

        TreeSet<Integer> numbers = new TreeSet<>();
        numbers.addAll(variantByNumber.keySet());
        numbers.addAll(releaseByNumber.keySet());
        int highest = Math.max(total == null ? 0 : total, numbers.isEmpty() ? 0 : numbers.last());
        if (highest <= MAX_FILLED_VOLUMES) {
            for (int number = 1; number <= highest; number++) {
                numbers.add(number);
            }
        }

        List<WorkElement> elements = new ArrayList<>();
        for (int number : numbers) {
            Variant variant = variantByNumber.get(number);
            ReleaseEntry release = releaseByNumber.get(number);
            Optional<Ownership> ownership = variant == null ? Optional.empty() : activeOwnerships.stream()
                    .filter(o -> o.variantId().filter(variant.id()::equals).isPresent())
                    .findFirst();
            boolean wanted = variant != null && wishes.stream()
                    .anyMatch(w -> w.variantId().filter(variant.id()::equals).isPresent());
            ReleaseDate date = release != null ? release.date()
                    : variant == null ? null : ReleaseDate.parse(variant.attributes().get("releaseDate")).orElse(null);
            String cover = variant != null && WorkElementsContext.coverOf(variant.attributes()) != null
                    ? WorkElementsContext.coverOf(variant.attributes())
                    : release == null ? null : release.coverImageUrl();
            elements.add(new WorkElement("volume-" + number, "Tome " + number, number, cover,
                    WorkElement.stateOf(ownership.isPresent(), wanted, date, today), date,
                    variant == null ? null : variant.id(), ownership.map(Ownership::id).orElse(null)));
        }
        elements.sort(Comparator.comparing(WorkElement::number));
        return new WorkElements(series.id(), elements, total);
    }

    private static String editionOf(Variant variant) {
        Object value = variant.attributes().get("edition");
        return value instanceof String s ? s.trim() : "";
    }
}
