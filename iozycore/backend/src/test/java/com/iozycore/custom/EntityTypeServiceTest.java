package com.iozycore.custom;

import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.shared.EntityTypeDeletionNotAllowedException;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EntityTypeServiceTest {

    private final InMemoryEntityTypeRepository types = new InMemoryEntityTypeRepository(
            EntityTypeFixtures.MANGA, EntityTypeFixtures.VIDEO_GAME, EntityTypeFixtures.BOARD_GAME);
    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final EntityTypeService service = new EntityTypeService(types, entities);

    @Test
    void a_built_in_type_cannot_be_deleted_even_when_no_work_uses_it() {
        for (EntityType builtIn : Set.of(EntityTypeFixtures.MANGA, EntityTypeFixtures.VIDEO_GAME,
                EntityTypeFixtures.BOARD_GAME)) {
            assertThatThrownBy(() -> service.delete(builtIn.id())).isInstanceOf(IllegalStateException.class);
            assertThat(types.findById(builtIn.id())).isPresent();
        }
    }

    @Test
    void a_custom_type_without_works_can_be_deleted() {
        EntityType vinyl = service.create("VINYL", "Vinyle", Set.of("PLAYED"), Set.of());

        service.delete(vinyl.id());

        assertThat(types.findById(vinyl.id())).isEmpty();
    }

    @Test
    void a_custom_type_still_used_by_a_work_cannot_be_deleted() {
        EntityType vinyl = service.create("VINYL", "Vinyle", Set.of("PLAYED"), Set.of());
        entities.save(Entity.create(vinyl.id(), "Abbey Road"));

        assertThatThrownBy(() -> service.delete(vinyl.id()))
                .isInstanceOf(EntityTypeDeletionNotAllowedException.class);
    }

    @Test
    void updating_or_deleting_an_unknown_type_is_not_found() {
        UUID unknown = UUID.randomUUID();

        assertThatThrownBy(() -> service.update(unknown, "X", Set.of(), Set.of()))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.update(unknown, "X", Set.of(), Set.of(), null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete(unknown)).isInstanceOf(NotFoundException.class);
    }
}
