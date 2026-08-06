package com.iozycore.domain.catalog;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EntityTest {

    @Test
    void creating_an_entity_raises_entity_created_event() {
        Entity entity = Entity.create(EntityType.MANGA.id(), "Death Note");

        List<?> events = entity.pullDomainEvents();

        assertEquals(1, events.size());
        assertTrue(events.get(0) instanceof EntityCreated);
        assertEquals("Death Note", ((EntityCreated) events.get(0)).title());
    }

    @Test
    void pulling_domain_events_clears_them() {
        Entity entity = Entity.create(EntityType.VIDEO_GAME.id(), "Hollow Knight");
        entity.pullDomainEvents();

        assertTrue(entity.pullDomainEvents().isEmpty());
    }

    @Test
    void title_cannot_be_blank() {
        assertThrows(IllegalArgumentException.class, () -> Entity.create(EntityType.BOARD_GAME.id(), "  "));
    }

    @Test
    void a_variant_can_be_added_without_existing_outside_its_entity() {
        Entity entity = Entity.create(EntityType.MANGA.id(), "Death Note");

        Variant variant = entity.addVariant("Black Edition", Map.of("volumeCount", 6));

        assertEquals(1, entity.variants().size());
        assertEquals(variant.label(), entity.variants().get(0).label());
    }

    @Test
    void reconstituted_entity_does_not_raise_new_events() {
        UUID id = UUID.randomUUID();
        Entity entity = Entity.reconstitute(id, EntityType.MANGA.id(), "Berserk",
                Map.of(), List.of(), Set.of());

        assertTrue(entity.pullDomainEvents().isEmpty());
    }
}
