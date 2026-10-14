package com.iozycore.core.application;

import com.iozycore.core.application.WishlistService.AddToWishlist;
import com.iozycore.core.application.WishlistService.WishlistStatus;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.metadata.MetadataDetailsService;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryFollowedWorkRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WishlistServiceTest {

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryWishlistEntryRepository wishes = new InMemoryWishlistEntryRepository();
    private final InMemoryFollowedWorkRepository follows = new InMemoryFollowedWorkRepository();
    private final InMemoryEntityTypeRepository types = new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA);

    private final WishlistService service = new WishlistService(wishes, ownerships, entities, types,
            new CatalogEntityResolver(entities),
            new TomeResolver(entities, List.of(), List.of()),
            new WorkFollowing(follows, wishes, ownerships, entities),
            new MetadataDetailsService(List.of(), types));

    @Test
    void wanting_a_whole_work_creates_one_entry_and_stops_following_it() {
        Entity work = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren"));
        follows.save(FollowedWork.follow(work.id(), LocalDate.now()));

        WishlistEntry entry = service.add(byEntity(work.id(), null, null));

        assertThat(entry.entityId()).isEqualTo(work.id());
        assertThat(entry.variantId()).isEmpty();
        assertThat(follows.findByEntityId(work.id())).isEmpty();
    }

    @Test
    void wanting_the_same_volume_twice_returns_the_first_entry() {
        Entity work = Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren");
        Variant volume = work.addVariant("Tome 3", Map.of());
        entities.save(work);

        WishlistEntry first = service.add(byEntity(work.id(), volume.id(), null));
        WishlistEntry second = service.add(byEntity(work.id(), volume.id(), null));

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(wishes.findAll()).hasSize(1);
    }

    @Test
    void refuses_a_volume_of_another_work() {
        Entity work = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren"));
        Entity other = Entity.create(EntityTypeFixtures.MANGA.id(), "Dandadan");
        Variant foreignVolume = other.addVariant("Tome 1", Map.of());
        entities.save(other);

        assertThatThrownBy(() -> service.add(byEntity(work.id(), foreignVolume.id(), null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("n'appartient pas");
    }

    @Test
    void refuses_a_volume_that_is_already_owned() {
        Entity work = Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren");
        Variant volume = work.addVariant("Tome 1", Map.of());
        entities.save(work);
        ownerships.save(Ownership.acquire(work.id(), volume.id(), OwnershipCondition.NEW, LocalDate.now(), null));

        assertThatThrownBy(() -> service.add(byEntity(work.id(), volume.id(), null)))
                .isInstanceOf(IllegalStateException.class);
        assertThat(wishes.findAll()).isEmpty();
    }

    @Test
    void a_volume_number_creates_the_missing_volume_in_the_catalog() {
        Entity work = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren"));

        WishlistEntry entry = service.add(byEntity(work.id(), null, 4));

        UUID volumeId = entry.variantId().orElseThrow();
        assertThat(entities.findById(work.id()).orElseThrow().variants())
                .anyMatch(v -> v.id().equals(volumeId));
        assertThat(ownerships.findAll()).isEmpty();
    }

    @Test
    void refuses_an_invalid_volume_number() {
        Entity work = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren"));

        assertThatThrownBy(() -> service.add(byEntity(work.id(), null, 0)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void refuses_an_unknown_work() {
        assertThatThrownBy(() -> service.add(byEntity(UUID.randomUUID(), null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Entité introuvable");
    }

    @Test
    void a_work_from_an_external_source_is_created_in_the_catalog_without_ownership() {
        WishlistEntry entry = service.add(new AddToWishlist(null, null, null, null,
                EntityTypeFixtures.MANGA.id(), "Blue Period", Map.of()));

        assertThat(entities.findById(entry.entityId())).map(Entity::title).contains("Blue Period");
        assertThat(ownerships.findAll()).isEmpty();
    }

    @Test
    void refuses_a_request_with_neither_entity_nor_title() {
        assertThatThrownBy(() -> service.add(new AddToWishlist(null, null, null, null,
                EntityTypeFixtures.MANGA.id(), " ", Map.of())))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void lookup_tells_owned_then_wanted_then_unknown() {
        Entity owned = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren"));
        ownerships.save(Ownership.acquire(owned.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        Entity wanted = Entity.create(EntityTypeFixtures.MANGA.id(), "Dandadan");
        Variant volume = wanted.addVariant("Tome 2", Map.of());
        entities.save(wanted);
        service.add(byEntity(wanted.id(), volume.id(), null));

        assertThat(service.lookup(owned.id())).isEqualTo(WishlistStatus.OWNED);
        assertThat(service.lookup(wanted.id())).isEqualTo(WishlistStatus.WISHLISTED);
        assertThat(service.lookup(UUID.randomUUID())).isEqualTo(WishlistStatus.UNKNOWN);
    }

    private static AddToWishlist byEntity(UUID entityId, UUID variantId, Integer volumeNumber) {
        return new AddToWishlist(entityId, variantId, volumeNumber, null, null, null, null);
    }
}
