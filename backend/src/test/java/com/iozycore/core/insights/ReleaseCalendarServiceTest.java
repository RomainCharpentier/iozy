package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The release calendar, seen from the core: the dates entered on detail pages,
 * the routing to the universes, the order, and the period bounds.
 * Each universe has its own tests for its own dates.
 */
class ReleaseCalendarServiceTest {

    private static final LocalDate OCTOBER_1 = LocalDate.of(2026, 10, 1);
    private static final LocalDate OCTOBER_31 = LocalDate.of(2026, 10, 31);

    private final InMemoryEntityTypeRepository types = new InMemoryEntityTypeRepository();
    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryWishlistEntryRepository wishlist = new InMemoryWishlistEntryRepository();
    private final InMemoryFollowedWorkRepository followed = new InMemoryFollowedWorkRepository();

    private ReleaseCalendarService service(ReleaseSource... sources) {
        return new ReleaseCalendarService(types, entities, ownerships, wishlist, followed, List.of(sources));
    }

    // ------------------------------------------------------------ Dates entered on a detail page

    @Test
    void lists_a_hand_written_release_date_of_an_owned_work_of_any_category() {
        Entity game = boardGame("Ark Nova", "2026-10-14");
        ownerships.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        suivre(game);

        ReleaseCalendar calendar = service().releasesBetween(OCTOBER_1, OCTOBER_31);

        assertThat(calendar.entries()).hasSize(1);
        ReleaseEntry entry = calendar.entries().get(0);
        assertThat(entry.date()).isEqualTo(ReleaseDate.ofDay(LocalDate.of(2026, 10, 14)));
        assertThat(entry.entityId()).isEqualTo(game.id());
        assertThat(entry.entityTitle()).isEqualTo("Ark Nova");
        assertThat(entry.entityTypeId()).isEqualTo(EntityTypeFixtures.BOARD_GAME.id());
        assertThat(entry.relation()).isEqualTo(ReleaseEntry.Relation.OWNED);
        assertThat(entry.source()).isEqualTo(ReleaseCalendarService.MANUAL_SOURCE);
        assertThat(entry.label()).isEmpty();
        assertThat(entry.volumeNumber()).isNull();
    }

    @Test
    void a_followed_work_nobody_owns_is_listed_as_missing_and_a_month_precision_is_kept() {
        Entity game = boardGame("Dune Imperium", "2026-10");
        suivre(game);

        ReleaseCalendar calendar = service().releasesBetween(OCTOBER_1, OCTOBER_31);

        assertThat(calendar.entries()).singleElement().satisfies(entry -> {
            assertThat(entry.relation()).isEqualTo(ReleaseEntry.Relation.MISSING);
            assertThat(entry.date().precision()).isEqualTo(ReleaseDate.Precision.MONTH);
        });
    }

    @Test
    void ignores_dates_outside_the_period_years_alone_and_works_that_matter_to_nobody() {
        Entity inNovember = boardGame("Trop tard", "2026-11-02");
        ownerships.save(Ownership.acquire(inNovember.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        Entity yearOnly = boardGame("Juste une année", "2026");
        ownerships.save(Ownership.acquire(yearOnly.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        boardGame("Ni suivi, ni possédé, ni voulu", "2026-10-10");
        Entity sold = boardGame("Revendu", "2026-10-12");
        Ownership soldOwnership = Ownership.acquire(sold.id(), null, OwnershipCondition.USED, LocalDate.now(), null);
        soldOwnership.markSold();
        ownerships.save(soldOwnership);

        // The resold item is no longer owned, and nobody follows or wants it: out. (If followed, it
        // would show as "to buy", and that would be right.)
        suivre(inNovember, yearOnly);

        assertThat(service().releasesBetween(OCTOBER_1, OCTOBER_31).entries()).isEmpty();
    }

    @Test
    void an_owned_work_nobody_follows_is_listed_as_owned() {
        Entity game = boardGame("Ark Nova", "2026-10-14");
        ownerships.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        assertThat(service().releasesBetween(OCTOBER_1, OCTOBER_31).entries()).singleElement()
                .satisfies(entry -> assertThat(entry.relation()).isEqualTo(ReleaseEntry.Relation.OWNED));
    }

    @Test
    void a_wanted_work_nobody_follows_is_listed_as_wanted() {
        Entity game = boardGame("Dune Imperium", "2026-10-20");
        wishlist.save(WishlistEntry.add(game.id(), LocalDate.now()));

        assertThat(service().releasesBetween(OCTOBER_1, OCTOBER_31).entries()).singleElement()
                .satisfies(entry -> assertThat(entry.relation()).isEqualTo(ReleaseEntry.Relation.WANTED));
        assertThat(service().latest(10)).extracting(ReleaseEntry::entityTitle).containsExactly("Dune Imperium");
    }

    @Test
    void takes_the_cover_of_the_work_when_it_has_one() {
        Entity game = boardGame("Ark Nova", "2026-10-14");
        game.setAttribute("coverImageUrl", "https://img/ark-nova.jpg");
        entities.save(game);
        ownerships.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        suivre(game);

        assertThat(service().releasesBetween(OCTOBER_1, OCTOBER_31).entries().get(0).coverImageUrl())
                .isEqualTo("https://img/ark-nova.jpg");
    }

    // ------------------------------------------------------------ Routing to the universes

    @Test
    void asks_each_source_that_covers_a_category_with_only_the_works_of_that_category() {
        Entity naruto = manga("Naruto");
        Entity ark = boardGame("Ark Nova", null);
        ownerships.save(Ownership.acquire(naruto.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        ownerships.save(Ownership.acquire(ark.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        suivre(naruto, ark);
        RecordingSource mangaSource = new RecordingSource("MANGA");
        RecordingSource gameSource = new RecordingSource("VIDEO_GAME");

        service(mangaSource, gameSource).releasesBetween(OCTOBER_1, OCTOBER_31);

        assertThat(mangaSource.contexts).hasSize(1);
        ReleaseContext context = mangaSource.contexts.get(0);
        assertThat(context.entityType()).isEqualTo(EntityTypeFixtures.MANGA);
        assertThat(context.entities()).extracting(Entity::title).containsExactly("Naruto");
        assertThat(context.activeOwnerships()).extracting(Ownership::entityId).containsExactly(naruto.id());
        assertThat(context.from()).isEqualTo(OCTOBER_1);
        assertThat(context.to()).isEqualTo(OCTOBER_31);
        // No video game followed: the source is not disturbed.
        assertThat(gameSource.contexts).isEmpty();
    }

    @Test
    void merges_the_entries_of_the_sources_with_the_hand_written_ones_in_calendar_order() {
        Entity naruto = manga("Naruto");
        Entity ark = boardGame("Ark Nova", "2026-10-14");
        ownerships.save(Ownership.acquire(naruto.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        ownerships.save(Ownership.acquire(ark.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        suivre(naruto, ark);
        RecordingSource mangaSource = new RecordingSource("MANGA",
                tome(naruto, 73, LocalDate.of(2026, 10, 14)),
                tome(naruto, 72, LocalDate.of(2026, 10, 2)));

        List<ReleaseEntry> entries = service(mangaSource).releasesBetween(OCTOBER_1, OCTOBER_31).entries();

        // By date; on equal date, by title; on equal title, by volume number.
        assertThat(entries).extracting(entry -> (entry.entityTitle() + " " + entry.label()).trim())
                .containsExactly("Naruto Tome 72", "Ark Nova", "Naruto Tome 73");
    }

    @Test
    void reads_nothing_and_asks_nobody_when_nothing_is_followed() {
        manga("Naruto");
        RecordingSource mangaSource = new RecordingSource("MANGA");

        ReleaseCalendar calendar = service(mangaSource).releasesBetween(OCTOBER_1, OCTOBER_31);

        assertThat(calendar.entries()).isEmpty();
        assertThat(mangaSource.contexts).isEmpty();
        assertThat(entities.readsByType).isZero();
    }

    @Test
    void reads_the_catalogue_once_per_category_whatever_the_number_of_works() {
        for (int i = 0; i < 40; i++) {
            Entity serie = manga("Série " + i);
            ownerships.save(Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
            suivre(serie);
        }

        service(new RecordingSource("MANGA")).releasesBetween(OCTOBER_1, OCTOBER_31);

        assertThat(entities.readsByType).isEqualTo(types.findAll().size());
        assertThat(ownerships.reads).isEqualTo(1);
        assertThat(wishlist.reads).isEqualTo(1);
        assertThat(followed.reads).isEqualTo(1);
    }

    @Test
    void says_which_categories_an_universe_covers() {
        ReleaseCalendarService service = service(new RecordingSource("MANGA"));

        assertThat(service.hasReleaseSource(EntityTypeFixtures.MANGA)).isTrue();
        assertThat(service.hasReleaseSource(EntityTypeFixtures.BOARD_GAME)).isFalse();
    }

    // ------------------------------------------------------------ The period bounds

    @Test
    void refuses_a_period_that_is_missing_reversed_or_longer_than_a_year() {
        ReleaseCalendarService service = service();

        assertThatThrownBy(() -> service.releasesBetween(null, OCTOBER_31)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.releasesBetween(OCTOBER_31, OCTOBER_1)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("précède");
        assertThatThrownBy(() -> service.releasesBetween(OCTOBER_1, OCTOBER_1.plusDays(366)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("un an");
        // Exactly one year passes; a single day too.
        assertThat(service.releasesBetween(OCTOBER_1, OCTOBER_1.plusDays(365)).entries()).isEmpty();
        assertThat(service.releasesBetween(OCTOBER_1, OCTOBER_1).entries()).isEmpty();
    }

    // ------------------------------------------------------------ The latest releases

    @Test
    void the_latest_are_the_newest_dates_future_or_past_with_no_one_year_limit() {
        Entity old = boardGame("Très ancien", "2019-03-01");
        Entity past = boardGame("Passé", "2026-05-20");
        Entity future = boardGame("Futur", "2027-02-11");
        Entity monthOnly = boardGame("Au mois", "2026-12");
        suivre(old, past, future, monthOnly);

        List<ReleaseEntry> latest = service().latest(3);

        // Newest first; a month sorts as its first day, below the days of that month.
        assertThat(latest).extracting(ReleaseEntry::entityTitle).containsExactly("Futur", "Au mois", "Passé");
        assertThat(service().latest(10)).extracting(ReleaseEntry::entityTitle).endsWith("Très ancien");
    }

    @Test
    void the_latest_are_empty_when_nothing_matters_to_the_collector_and_refuse_a_limit_that_is_not_positive() {
        boardGame("Ni suivi, ni possédé, ni voulu", "2026-10-10");

        assertThat(service().latest(10)).isEmpty();
        assertThatThrownBy(() -> service().latest(0)).isInstanceOf(IllegalArgumentException.class);
    }

    // ------------------------------------------------------------ Factory

    private Entity manga(String title) {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), title);
        return entities.save(entity);
    }

    private Entity boardGame(String title, String releaseDate) {
        Entity entity = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), title);
        if (releaseDate != null) {
            entity.setAttribute(ReleaseCalendarService.RELEASE_DATE_ATTRIBUTE, releaseDate);
        }
        return entities.save(entity);
    }

    /** Follow: what puts a work on the calendar, whatever one owns of it. */
    private void suivre(Entity... oeuvres) {
        for (Entity oeuvre : oeuvres) {
            followed.save(FollowedWork.follow(oeuvre.id(), LocalDate.now()));
        }
    }

    private static ReleaseEntry tome(Entity serie, int number, LocalDate day) {
        return new ReleaseEntry(ReleaseDate.ofDay(day), serie.id(), serie.title(), serie.entityTypeId(),
                "Tome " + number, number, "Kana", null, ReleaseEntry.Relation.MISSING, "GOOGLE_BOOKS");
    }

    /** A source that records what it is asked and returns what it was given. */
    private static class RecordingSource implements ReleaseSource {
        private final String code;
        private final List<ReleaseEntry> entries;
        final List<ReleaseContext> contexts = new ArrayList<>();

        RecordingSource(String code, ReleaseEntry... entries) {
            this.code = code;
            this.entries = List.of(entries);
        }

        @Override
        public boolean supports(EntityType entityType) {
            return code.equals(entityType.code());
        }

        @Override
        public List<ReleaseEntry> releasesBetween(ReleaseContext context) {
            contexts.add(context);
            return entries;
        }
    }

    private static class InMemoryEntityTypeRepository implements EntityTypeRepository {
        private final Map<UUID, EntityType> store = new HashMap<>(Map.of(
                EntityTypeFixtures.MANGA.id(), EntityTypeFixtures.MANGA,
                EntityTypeFixtures.VIDEO_GAME.id(), EntityTypeFixtures.VIDEO_GAME,
                EntityTypeFixtures.BOARD_GAME.id(), EntityTypeFixtures.BOARD_GAME));

        @Override
        public EntityType save(EntityType entityType) {
            store.put(entityType.id(), entityType);
            return entityType;
        }

        @Override
        public Optional<EntityType> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<EntityType> findByCode(String code) {
            return store.values().stream().filter(t -> t.code().equals(code)).findFirst();
        }

        @Override
        public List<EntityType> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryEntityRepository implements EntityRepository {
        private final Map<UUID, Entity> store = new HashMap<>();
        int readsByType;

        @Override
        public Entity save(Entity entity) {
            store.put(entity.id(), entity);
            return entity;
        }

        @Override
        public Optional<Entity> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
            return store.values().stream()
                    .filter(e -> e.entityTypeId().equals(entityTypeId) && e.title().equalsIgnoreCase(title))
                    .findFirst();
        }

        @Override
        public List<Entity> findAllByType(UUID entityTypeId) {
            readsByType++;
            return store.values().stream().filter(e -> e.entityTypeId().equals(entityTypeId)).toList();
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            return store.values().stream()
                    .filter(e -> titleQuery == null || e.title().toLowerCase().contains(titleQuery.toLowerCase()))
                    .filter(e -> entityTypeId == null || entityTypeId.equals(e.entityTypeId()))
                    .filter(e -> tagId == null || e.tagIds().contains(tagId))
                    .toList();
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            return store.values().stream().anyMatch(e -> e.entityTypeId().equals(entityTypeId));
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryOwnershipRepository implements OwnershipRepository {
        private final Map<UUID, Ownership> store = new HashMap<>();
        int reads;

        @Override
        public Ownership save(Ownership ownership) {
            store.put(ownership.id(), ownership);
            return ownership;
        }

        @Override
        public Optional<Ownership> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Ownership> findByEntityId(UUID entityId) {
            return store.values().stream().filter(o -> o.entityId().equals(entityId)).toList();
        }

        @Override
        public List<Ownership> findAll() {
            reads++;
            return new ArrayList<>(store.values());
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return store.values().stream().anyMatch(o -> o.entityId().equals(entityId));
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryWishlistEntryRepository implements WishlistEntryRepository {
        private final Map<UUID, WishlistEntry> store = new HashMap<>();
        int reads;

        @Override
        public WishlistEntry save(WishlistEntry entry) {
            store.put(entry.id(), entry);
            return entry;
        }

        @Override
        public Optional<WishlistEntry> findByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).findFirst();
        }

        @Override
        public Optional<WishlistEntry> findByVariantId(UUID variantId) {
            return store.values().stream().filter(e -> e.variantId().map(variantId::equals).orElse(false)).findFirst();
        }

        @Override
        public List<WishlistEntry> findAllByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
        }

        @Override
        public List<WishlistEntry> findAll() {
            reads++;
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryFollowedWorkRepository implements FollowedWorkRepository {
        private final Map<UUID, FollowedWork> store = new HashMap<>();
        int reads;

        @Override
        public FollowedWork save(FollowedWork work) {
            store.put(work.id(), work);
            return work;
        }

        @Override
        public Optional<FollowedWork> findByEntityId(UUID entityId) {
            return store.values().stream().filter(w -> w.entityId().equals(entityId)).findFirst();
        }

        @Override
        public List<FollowedWork> findAll() {
            reads++;
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteByEntityId(UUID entityId) {
            store.values().removeIf(w -> w.entityId().equals(entityId));
        }
    }
}
