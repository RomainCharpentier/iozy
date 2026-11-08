package com.iozycore.core.application.work;

import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.application.insights.ReleaseCalendarService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.work.CollectionSummary;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkView;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryFollowedWorkRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import com.iozycore.core.testing.InMemoryWorkCollectorStatusRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The counts of a work, the same for every type: what the core decides on top of
 * what a universe says (or of its own default, for a custom type).
 */
class WorkReadModelTest {

    private static final Instant NOW = Instant.parse("2026-11-08T10:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);
    private static final EntityType FIGURINES = EntityType.create("FIGURINES", "Figurines", Set.of(), Set.of());

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryEntityTypeRepository types = new InMemoryEntityTypeRepository(
            EntityTypeFixtures.MANGA, EntityTypeFixtures.BOARD_GAME, FIGURINES);
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryWishlistEntryRepository wishes = new InMemoryWishlistEntryRepository();
    private final InMemoryWorkCollectorStatusRepository statuses = new InMemoryWorkCollectorStatusRepository();
    private final ReleaseCalendarService calendar = new ReleaseCalendarService(types, entities, ownerships, wishes,
            new InMemoryFollowedWorkRepository(), statuses, List.of());

    private WorkReadModel readModel(WorkElementsSource... sources) {
        return readModel(Clock.fixed(NOW, ZoneOffset.UTC), sources);
    }

    private WorkReadModel readModel(Clock clock, WorkElementsSource... sources) {
        return new WorkReadModel(entities, types, ownerships, wishes, statuses, calendar, List.of(sources), clock);
    }

    @Test
    void a_custom_type_without_variants_is_its_own_single_element() {
        Entity statue = entities.save(Entity.create(FIGURINES.id(), "Statue Totoro"));
        Ownership copy = ownerships.save(Ownership.acquire(statue.id(), null, OwnershipCondition.NEW, TODAY, null));

        WorkView view = readModel().work(statue.id());

        assertThat(view.elements()).hasSize(1);
        WorkElement element = view.elements().get(0).element();
        assertThat(element.key()).isEqualTo("work");
        assertThat(element.label()).isEqualTo("Statue Totoro");
        assertThat(element.state()).isEqualTo(WorkElement.State.OWNED);
        assertThat(element.ownershipId()).isEqualTo(copy.id());
        assertThat(view.ownedCount()).isEqualTo(1);
        assertThat(view.totalCount()).isEqualTo(1);
        assertThat(view.missingCount()).isZero();
    }

    @Test
    void a_custom_type_with_variants_is_made_of_its_variants() {
        Entity serie = Entity.create(FIGURINES.id(), "Série Ghibli");
        Variant first = serie.addVariant("Totoro", Map.of("volumeNumber", 1));
        Variant second = serie.addVariant("Jiji", Map.of("volumeNumber", 2));
        serie.addVariant("Kodama", Map.of("volumeNumber", 3));
        entities.save(serie);
        ownerships.save(Ownership.acquire(serie.id(), first.id(), OwnershipCondition.NEW, TODAY, null));
        wishes.save(WishlistEntry.addVariant(serie.id(), second.id(), TODAY));

        WorkView view = readModel().work(serie.id());

        assertThat(view.elements()).extracting(c -> c.element().label()).containsExactly("Totoro", "Jiji", "Kodama");
        assertThat(view.elements()).extracting(c -> c.element().state()).containsExactly(
                WorkElement.State.OWNED, WorkElement.State.WANTED, WorkElement.State.MISSING);
        assertThat(view.ownedCount()).isEqualTo(1);
        assertThat(view.totalCount()).isEqualTo(3);
        assertThat(view.missingCount()).isEqualTo(2);
        assertThat(view.wishedCount()).isEqualTo(1);
    }

    @Test
    void a_copy_or_a_wish_on_the_whole_work_is_never_dropped_when_the_work_has_variants() {
        Entity serie = Entity.create(FIGURINES.id(), "Coffret Ghibli");
        serie.addVariant("Totoro", Map.of("volumeNumber", 1));
        serie.addVariant("Jiji", Map.of("volumeNumber", 2));
        serie.addVariant("Kodama", Map.of("volumeNumber", 3));
        entities.save(serie);
        Ownership whole = ownerships.save(Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, TODAY, null));
        Entity wishedBox = Entity.create(FIGURINES.id(), "Coffret voulu");
        wishedBox.addVariant("Chihiro", Map.of("volumeNumber", 1));
        entities.save(wishedBox);
        wishes.save(WishlistEntry.add(wishedBox.id(), TODAY));

        WorkView view = readModel().work(serie.id());

        assertThat(view.elements()).extracting(c -> c.element().key()).first().isEqualTo("work");
        assertThat(view.elements().get(0).element().state()).isEqualTo(WorkElement.State.OWNED);
        assertThat(view.elements().get(0).element().ownershipId()).isEqualTo(whole.id());
        assertThat(view.ownedCount()).isEqualTo(1);
        assertThat(view.totalCount()).isEqualTo(4);
        assertThat(view.missingCount()).isEqualTo(3);

        WorkView wished = readModel().work(wishedBox.id());
        assertThat(wished.elements()).extracting(c -> c.element().state())
                .containsExactly(WorkElement.State.WANTED, WorkElement.State.MISSING);
    }

    @Test
    void the_month_turns_at_midnight_in_the_collector_zone_not_the_server_zone() {
        Entity game = entities.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Jeu"));
        // 00:30 on December 1st in Paris, 23:30 on November 30th in UTC.
        Instant justAfterMidnight = Instant.parse("2026-11-30T23:30:00Z");
        // 23:30 on November 30th in Paris.
        Instant justBeforeMidnight = Instant.parse("2026-11-30T22:30:00Z");
        for (Instant created : List.of(justAfterMidnight, justBeforeMidnight)) {
            ownerships.save(Ownership.reconstitute(UUID.randomUUID(), game.id(), null, null, OwnershipCondition.NEW,
                    OwnershipStatus.OWNED, LocalDate.of(2026, 11, 30), null, null, created));
        }
        Clock paris = Clock.fixed(Instant.parse("2026-11-30T23:45:00Z"), ZoneId.of("Europe/Paris"));

        CollectionSummary summary = readModel(paris).summary();

        assertThat(summary.totalObjects()).isEqualTo(2);
        assertThat(summary.addedThisMonth()).isEqualTo(1);
    }

    @Test
    void a_paused_or_dropped_work_lists_its_missing_elements_but_counts_none() {
        Entity serie = Entity.create(FIGURINES.id(), "Série en pause");
        Variant first = serie.addVariant("Un", Map.of());
        serie.addVariant("Deux", Map.of());
        entities.save(serie);
        ownerships.save(Ownership.acquire(serie.id(), first.id(), OwnershipCondition.NEW, TODAY, null));
        WorkReadModel readModel = readModel();
        assertThat(readModel.work(serie.id()).missingCount()).isEqualTo(1);

        for (CollectorStatus status : List.of(CollectorStatus.PAUSED, CollectorStatus.DROPPED)) {
            readModel.setCollectorStatus(serie.id(), status);
            WorkView view = readModel.work(serie.id());
            assertThat(view.collectorStatus()).isEqualTo(status);
            assertThat(view.missingCount()).isZero();
            assertThat(view.elements()).hasSize(2);
            WorkView.CountedElement missing = view.elements().stream()
                    .filter(c -> c.element().label().equals("Deux")).findFirst().orElseThrow();
            assertThat(missing.element().state()).isEqualTo(WorkElement.State.MISSING);
            assertThat(missing.countedAsMissing()).isFalse();
        }

        readModel.setCollectorStatus(serie.id(), CollectorStatus.ONGOING);
        assertThat(readModel.work(serie.id()).missingCount()).isEqualTo(1);
    }

    @Test
    void an_unknown_total_from_the_universe_stays_unknown() {
        Entity serie = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Sans total"));
        WorkElementsSource unknownTotal = new FixedSource(EntityTypeFixtures.MANGA, serie.id(), List.of(
                new WorkElement("volume-1", "Tome 1", 1, null, WorkElement.State.MISSING, null, null, null)), null);

        WorkView view = readModel(unknownTotal).work(serie.id());

        assertThat(view.totalCount()).isNull();
        assertThat(view.totalKnown()).isFalse();
        assertThat(view.missingCount()).isEqualTo(1);
    }

    @Test
    void an_element_not_out_yet_is_never_counted_missing_even_when_wished() {
        Entity serie = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "À paraître"));
        com.iozycore.core.domain.insights.ReleaseDate nextMonth =
                com.iozycore.core.domain.insights.ReleaseDate.ofDay(TODAY.plusDays(20));
        WorkElementsSource source = new FixedSource(EntityTypeFixtures.MANGA, serie.id(), List.of(
                new WorkElement("volume-2", "Tome 2", 2, null, WorkElement.State.WANTED, nextMonth, null, null),
                new WorkElement("volume-3", "Tome 3", 3, null, WorkElement.State.UPCOMING, nextMonth, null, null)), 3);

        assertThat(readModel(source).work(serie.id()).missingCount()).isZero();
    }

    @Test
    void the_list_holds_owned_and_wished_works_only_and_another_type_falls_back_to_the_default() {
        Entity owned = entities.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Ark Nova"));
        Entity wished = entities.save(Entity.create(FIGURINES.id(), "Statue voulue"));
        Entity sold = entities.save(Entity.create(FIGURINES.id(), "Statue vendue"));
        entities.save(Entity.create(FIGURINES.id(), "Juste au catalogue"));
        ownerships.save(Ownership.acquire(owned.id(), null, OwnershipCondition.NEW, TODAY, null));
        wishes.save(WishlistEntry.add(wished.id(), TODAY));
        Ownership soldCopy = Ownership.acquire(sold.id(), null, OwnershipCondition.NEW, TODAY, null);
        soldCopy.markSold();
        ownerships.save(soldCopy);

        List<WorkView> works = readModel().works();

        assertThat(works).extracting(WorkView::title).containsExactlyInAnyOrder("Ark Nova", "Statue voulue");
        WorkView wish = works.stream().filter(w -> w.title().equals("Statue voulue")).findFirst().orElseThrow();
        assertThat(wish.elements().get(0).element().state()).isEqualTo(WorkElement.State.WANTED);
        assertThat(wish.wishedCount()).isEqualTo(1);
        assertThat(wish.lastMovedAt()).isNotNull();
    }

    @Test
    void the_summary_counts_active_copies_and_additions_of_this_month_by_creation_time() {
        Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), "Résumé");
        Variant one = serie.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entities.save(serie);
        Entity game = entities.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Jeu ancien"));
        // Two copies of the same volume are two objects.
        ownerships.save(Ownership.acquire(serie.id(), one.id(), OwnershipCondition.NEW, TODAY, null));
        ownerships.save(Ownership.acquire(serie.id(), one.id(), OwnershipCondition.USED, TODAY, null));
        // Added long ago, bought long ago: an object, not an addition of this month.
        ownerships.save(Ownership.reconstitute(UUID.randomUUID(), game.id(), null, null, OwnershipCondition.NEW,
                OwnershipStatus.OWNED, LocalDate.of(2020, 1, 1), null, null, Instant.parse("2020-01-01T00:00:00Z")));
        // Sold: not an object any more.
        Ownership sold = Ownership.acquire(game.id(), null, OwnershipCondition.NEW, TODAY, null);
        sold.markSold();
        ownerships.save(sold);
        wishes.save(WishlistEntry.add(entities.save(Entity.create(FIGURINES.id(), "Voulu")).id(), TODAY));

        CollectionSummary summary = readModel().summary();

        assertThat(summary.totalObjects()).isEqualTo(3);
        assertThat(summary.addedThisMonth()).isEqualTo(2);
        assertThat(summary.byType()).containsExactlyInAnyOrder(
                new CollectionSummary.TypeCount(EntityTypeFixtures.MANGA.id(), 2),
                new CollectionSummary.TypeCount(EntityTypeFixtures.BOARD_GAME.id(), 1));
        assertThat(summary.addedThisMonthByType()).containsExactly(
                new CollectionSummary.TypeCount(EntityTypeFixtures.MANGA.id(), 2));
    }

    @Test
    void an_unknown_work_is_not_found_and_a_status_needs_a_value() {
        WorkReadModel readModel = readModel();
        assertThatThrownBy(() -> readModel.work(UUID.randomUUID())).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> readModel.setCollectorStatus(UUID.randomUUID(), CollectorStatus.PAUSED))
                .isInstanceOf(NotFoundException.class);
        Entity statue = entities.save(Entity.create(FIGURINES.id(), "Statue"));
        assertThatThrownBy(() -> readModel.setCollectorStatus(statue.id(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** A universe that answers fixed elements for one work. */
    private record FixedSource(EntityType type, UUID entityId, List<WorkElement> elements, Integer total)
            implements WorkElementsSource {

        @Override
        public boolean supports(EntityType entityType) {
            return entityType.id().equals(type.id());
        }

        @Override
        public List<WorkElements> elementsOf(com.iozycore.core.domain.work.WorkElementsContext context) {
            return List.of(new WorkElements(entityId, elements, total));
        }
    }
}
