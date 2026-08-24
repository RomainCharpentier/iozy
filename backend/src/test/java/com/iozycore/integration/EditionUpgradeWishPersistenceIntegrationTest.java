package com.iozycore.integration;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.editionupgrade.EditionUpgradeWish;
import com.iozycore.domain.editionupgrade.EditionUpgradeWishRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Validates the EditionUpgradeWish persistence module (Flyway V6 + JPA) against a real PostgreSQL. */
class EditionUpgradeWishPersistenceIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private EditionUpgradeWishRepository wishRepository;

    @Autowired
    private EntityRepository entityRepository;

    private UUID createMangaEntity() {
        return entityRepository.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Berserk " + UUID.randomUUID())).id();
    }

    @Test
    void a_wish_can_be_saved_reloaded_and_deleted() {
        UUID entityId = createMangaEntity();
        EditionUpgradeWish wish = wishRepository.save(
                EditionUpgradeWish.create(entityId, "Standard", "Deluxe", "Épuisée en standard"));

        assertThat(wishRepository.findById(wish.id())).isPresent();
        assertThat(wishRepository.findByEntityId(entityId)).extracting(EditionUpgradeWish::id).contains(wish.id());
        assertThat(wishRepository.findAll()).extracting(EditionUpgradeWish::id).contains(wish.id());

        wishRepository.deleteById(wish.id());

        assertThat(wishRepository.findById(wish.id())).isEmpty();
    }

    @Test
    void findByEntityId_only_returns_wishes_for_that_entity() {
        UUID entityId = createMangaEntity();
        UUID otherEntityId = createMangaEntity();
        EditionUpgradeWish wish = wishRepository.save(EditionUpgradeWish.create(entityId, "Standard", null, null));
        wishRepository.save(EditionUpgradeWish.create(otherEntityId, "Standard", null, null));

        assertThat(wishRepository.findByEntityId(entityId)).extracting(EditionUpgradeWish::id)
                .containsExactly(wish.id());
    }
}
