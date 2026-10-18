package com.iozycore.integration;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/** Validates the WishlistEntry persistence module against a real PostgreSQL - mirrors
 * the other persistence modules. Focused on the removal ("Retirer de la wishlist") flow:
 * round-trip, idempotence of deleteById, and no side effect on the catalogue/the collection. */
class WishlistEntryPersistenceIntegrationTest extends PostgresIntegrationTest {


    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    private UUID createMangaEntity() {
        return entityRepository.save(Entity.create(EntityTypeFixtures.MANGA.id(), "One Piece " + UUID.randomUUID())).id();
    }

    @Test
    void a_wishlist_entry_can_be_saved_reloaded_and_deleted() {
        UUID entityId = createMangaEntity();
        WishlistEntry entry = wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));

        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isPresent();
        assertThat(wishlistEntryRepository.findAll()).extracting(WishlistEntry::id).contains(entry.id());

        wishlistEntryRepository.deleteById(entry.id());

        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isEmpty();
        assertThat(wishlistEntryRepository.findAll()).extracting(WishlistEntry::id).doesNotContain(entry.id());
    }

    @Test
    void deleteById_is_idempotent_on_an_already_removed_entry() {
        UUID entityId = createMangaEntity();
        WishlistEntry entry = wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));

        wishlistEntryRepository.deleteById(entry.id());

        // Double removal (double click, obsolete tile after a late reload...): never an error,
        // see the contract documented on WishlistEntryRepository.deleteById.
        assertThatCode(() -> wishlistEntryRepository.deleteById(entry.id())).doesNotThrowAnyException();
    }

    @Test
    void deleteById_is_idempotent_on_an_id_that_never_existed() {
        assertThatCode(() -> wishlistEntryRepository.deleteById(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void removing_a_wishlist_entry_never_touches_the_referenced_entity_or_ownership() {
        // Same entityId on both sides on purpose (the most demanding case): if any key sharing
        // triggered a cascade, this is where it would be seen.
        UUID entityId = createMangaEntity();
        Ownership ownership = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        WishlistEntry entry = wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));

        wishlistEntryRepository.deleteById(entry.id());

        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isEmpty();
        assertThat(entityRepository.findById(entityId)).isPresent();
        assertThat(ownershipRepository.findById(ownership.id())).isPresent();
    }
}
