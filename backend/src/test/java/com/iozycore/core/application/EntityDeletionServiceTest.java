package com.iozycore.core.application;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryExperienceRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.iozycore.manga.MangaEditionDeletionGuard;

/**
 * Checks the delete guard of an Entity (Series), including the step 5 extension
 * (Series -> Edition -> Volume model): also blocked as long as a catalog Edition
 * still references it.
 */
class EntityDeletionServiceTest {

    private final InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
    private final InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
    private final InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
    private final EntityDeletionService service =
            new EntityDeletionService(entityRepository, ownershipRepository, experienceRepository, List.of(new MangaEditionDeletionGuard(mangaEditionRepository)));

    @Test
    void an_entity_with_no_reference_at_all_is_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);

        service.delete(entity.id());

        assertThat(entityRepository.findById(entity.id())).isEmpty();
    }

    @Test
    void an_entity_referenced_by_an_ownership_is_never_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        assertThatThrownBy(() -> service.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessage("Impossible de supprimer cette fiche : elle a encore 1 exemplaire.");
        assertThat(entityRepository.findById(entity.id())).isPresent();
    }

    @Test
    void an_entity_referenced_by_an_experience_is_never_deleted() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);
        experienceRepository.save(Experience.record_(entity.id(), null, "READ", LocalDate.now(), 8, null));

        assertThatThrownBy(() -> service.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessage("Impossible de supprimer cette fiche : elle a encore 1 expérience.");
    }

    @Test
    void an_entity_still_referenced_by_a_catalog_edition_is_never_deleted() {
        // Step 5: without this guard, the FK constraint manga_edition.entity_id
        // would reject the deletion with a raw SQL error instead of a clear message.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(entity);
        mangaEditionRepository.save(MangaEdition.create(entity.id(), "Death Note", "Perfect Edition",
                EditionTier.DELUXE, "Kana", 6, null, false, false, null));

        assertThatThrownBy(() -> service.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessage("Impossible de supprimer cette fiche : elle a encore 1 édition.");
        assertThat(entityRepository.findById(entity.id())).isPresent();
    }
}
