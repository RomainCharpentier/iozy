package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import com.iozycore.manga.insights.CollectionProgressService;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The volumes of a series as elements: one edition, its total when known, its gaps, its announced volumes. */
class MangaWorkElementsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryMangaEditionRepository editions = new InMemoryMangaEditionRepository();
    private final FakeFollowedEditions followed = new FakeFollowedEditions();
    private final MangaWorkElements source = new MangaWorkElements(
            new CollectionProgressService(entities, ownerships, editions), followed);

    @Test
    void with_a_known_total_lists_every_volume_and_the_gaps_are_missing() {
        Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), "Akira");
        Variant one = serie.addVariant("Tome 1", Map.of("edition", "Glénat", "volumeNumber", 1,
                "coverImageUrl", "https://img/1.jpg"));
        Variant three = serie.addVariant("Tome 3", Map.of("edition", "Glénat", "volumeNumber", 3));
        entities.save(serie);
        editions.save(MangaEdition.create(serie.id(), "Akira", "Glénat", EditionTier.STANDARD, "Glénat", 6,
                null, false, false, null));
        Ownership copy = Ownership.acquire(serie.id(), one.id(), OwnershipCondition.NEW, TODAY, null);
        WishlistEntry wish = WishlistEntry.addVariant(serie.id(), three.id(), TODAY);

        WorkElements elements = elementsOf(serie, List.of(copy), List.of(wish), List.of());

        assertThat(elements.totalCount()).isEqualTo(6);
        assertThat(elements.elements()).extracting(WorkElement::number).containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(elements.elements()).extracting(WorkElement::state).containsExactly(
                WorkElement.State.OWNED, WorkElement.State.MISSING, WorkElement.State.WANTED,
                WorkElement.State.MISSING, WorkElement.State.MISSING, WorkElement.State.MISSING);
        WorkElement first = elements.elements().get(0);
        assertThat(first.label()).isEqualTo("Tome 1");
        assertThat(first.ownershipId()).isEqualTo(copy.id());
        assertThat(first.variantId()).isEqualTo(one.id());
        assertThat(first.coverImageUrl()).isEqualTo("https://img/1.jpg");
        assertThat(elements.elements().get(1).variantId()).isNull();
    }

    @Test
    void without_a_total_the_total_stays_unknown_and_only_known_numbers_are_listed() {
        Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), "Sans total");
        Variant one = serie.addVariant("Tome 1", Map.of("edition", "Kana", "volumeNumber", 1));
        serie.addVariant("Tome 3", Map.of("edition", "Kana", "volumeNumber", 3));
        entities.save(serie);

        WorkElements elements = elementsOf(serie,
                List.of(Ownership.acquire(serie.id(), one.id(), OwnershipCondition.NEW, TODAY, null)),
                List.of(), List.of());

        assertThat(elements.totalCount()).isNull();
        // Volume 2 is a gap before a known volume 3: published, not owned.
        assertThat(elements.elements()).extracting(WorkElement::number).containsExactly(1, 2, 3);
    }

    @Test
    void an_announced_volume_of_the_edition_is_upcoming() {
        Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), "Annoncée");
        Variant one = serie.addVariant("Tome 1", Map.of("edition", "Kana", "volumeNumber", 1));
        entities.save(serie);
        ReleaseEntry tome2 = new ReleaseEntry(ReleaseDate.ofDay(TODAY.plusDays(10)), serie.id(), serie.title(),
                serie.entityTypeId(), "Tome 2 · Kana", 2, "Kana", "https://img/2.jpg",
                ReleaseEntry.Relation.MISSING, "GOOGLE_BOOKS");
        ReleaseEntry otherEdition = new ReleaseEntry(ReleaseDate.ofDay(TODAY.plusDays(5)), serie.id(), serie.title(),
                serie.entityTypeId(), "Tome 9 · Perfect", 9, "Perfect", null,
                ReleaseEntry.Relation.MISSING, "GOOGLE_BOOKS");

        WorkElements elements = elementsOf(serie,
                List.of(Ownership.acquire(serie.id(), one.id(), OwnershipCondition.NEW, TODAY, null)),
                List.of(), List.of(tome2, otherEdition));

        assertThat(elements.elements()).extracting(WorkElement::number).containsExactly(1, 2);
        WorkElement announced = elements.elements().get(1);
        assertThat(announced.state()).isEqualTo(WorkElement.State.UPCOMING);
        assertThat(announced.releaseDate()).isEqualTo(tome2.date());
        assertThat(announced.coverImageUrl()).isEqualTo("https://img/2.jpg");
    }

    @Test
    void the_followed_edition_wins_over_the_owned_one() {
        Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), "Deux éditions");
        Variant kana = serie.addVariant("Tome 1", Map.of("edition", "Kana", "volumeNumber", 1));
        serie.addVariant("Tome 1 Perfect", Map.of("edition", "Perfect", "volumeNumber", 1));
        serie.addVariant("Tome 2 Perfect", Map.of("edition", "Perfect", "volumeNumber", 2));
        entities.save(serie);
        followed.save(FollowedEdition.create(serie.id(), "Perfect"));

        WorkElements elements = elementsOf(serie,
                List.of(Ownership.acquire(serie.id(), kana.id(), OwnershipCondition.NEW, TODAY, null)),
                List.of(), List.of());

        assertThat(elements.elements()).hasSize(2)
                .allMatch(element -> element.state() == WorkElement.State.MISSING);
    }

    private WorkElements elementsOf(Entity serie, List<Ownership> owned, List<WishlistEntry> wished,
                                    List<ReleaseEntry> releases) {
        List<WorkElements> result = source.elementsOf(new WorkElementsContext(EntityTypeFixtures.MANGA,
                List.of(serie), owned, wished, releases, TODAY));
        assertThat(result).hasSize(1);
        return result.get(0);
    }

    private static class FakeFollowedEditions implements FollowedEditionRepository {
        private final Map<UUID, FollowedEdition> store = new HashMap<>();

        @Override
        public FollowedEdition save(FollowedEdition followedEdition) {
            store.put(followedEdition.entityId(), followedEdition);
            return followedEdition;
        }

        @Override
        public Optional<FollowedEdition> findByEntityId(UUID entityId) {
            return Optional.ofNullable(store.get(entityId));
        }

        @Override
        public List<FollowedEdition> findByEntityIdIn(List<UUID> entityIds) {
            return entityIds.stream().map(store::get).filter(Objects::nonNull).toList();
        }

        @Override
        public void deleteByEntityId(UUID entityId) {
            store.remove(entityId);
        }
    }
}
