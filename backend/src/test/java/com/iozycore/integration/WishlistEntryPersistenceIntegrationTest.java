package com.iozycore.integration;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/** Validates the WishlistEntry persistence module against a real PostgreSQL - mirrors
 * EditionUpgradeWishPersistenceIntegrationTest. Focused on the retrait ("Retirer de la wishlist") flow :
 * round-trip, idempotence de deleteById, et absence de tout effet de bord sur le catalogue/la collection. */
@Testcontainers
@SpringBootTest
@Transactional
class WishlistEntryPersistenceIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

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

        // Double retrait (double clic, tuile obsolète après un rechargement tardif...) : jamais une erreur,
        // voir le contrat documenté sur WishlistEntryRepository.deleteById.
        assertThatCode(() -> wishlistEntryRepository.deleteById(entry.id())).doesNotThrowAnyException();
    }

    @Test
    void deleteById_is_idempotent_on_an_id_that_never_existed() {
        assertThatCode(() -> wishlistEntryRepository.deleteById(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void removing_a_wishlist_entry_never_touches_the_referenced_entity_or_ownership() {
        // Même entityId des deux côtés à dessein (cas le plus exigeant) : si un quelconque partage de clé
        // déclenchait une cascade, ce serait ici qu'elle se verrait.
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
