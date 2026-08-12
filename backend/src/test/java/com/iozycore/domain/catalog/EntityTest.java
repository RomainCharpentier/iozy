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
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        List<?> events = entity.pullDomainEvents();

        assertEquals(1, events.size());
        assertTrue(events.get(0) instanceof EntityCreated);
        assertEquals("Death Note", ((EntityCreated) events.get(0)).title());
    }

    @Test
    void pulling_domain_events_clears_them() {
        Entity entity = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entity.pullDomainEvents();

        assertTrue(entity.pullDomainEvents().isEmpty());
    }

    @Test
    void title_cannot_be_blank() {
        assertThrows(IllegalArgumentException.class, () -> Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "  "));
    }

    @Test
    void a_variant_can_be_added_without_existing_outside_its_entity() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        Variant variant = entity.addVariant("Black Edition", Map.of("volumeCount", 6));

        assertEquals(1, entity.variants().size());
        assertEquals(variant.label(), entity.variants().get(0).label());
    }

    @Test
    void merging_variant_attributes_adds_new_keys_without_touching_others() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Black Edition"));

        entity.mergeVariantAttributes(variant.id(), Map.of("coverImageUrl", "https://example.com/tome1.jpg"));

        Variant updated = entity.variants().get(0);
        assertEquals(1, updated.attributes().get("volumeNumber"));
        assertEquals("Black Edition", updated.attributes().get("edition"));
        assertEquals("https://example.com/tome1.jpg", updated.attributes().get("coverImageUrl"));
        assertEquals(variant.id(), updated.id());
        assertEquals(variant.label(), updated.label());
    }

    @Test
    void merging_attributes_on_an_existing_key_overwrites_it() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("coverImageUrl", "https://example.com/old.jpg"));

        entity.mergeVariantAttributes(variant.id(), Map.of("coverImageUrl", "https://example.com/new.jpg"));

        assertEquals("https://example.com/new.jpg", entity.variants().get(0).attributes().get("coverImageUrl"));
    }

    @Test
    void merging_attributes_on_an_unknown_variant_fails_loudly() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        assertThrows(IllegalArgumentException.class,
                () -> entity.mergeVariantAttributes(UUID.randomUUID(), Map.of("coverImageUrl", "https://example.com/x.jpg")));
    }

    @Test
    void reconstituted_entity_does_not_raise_new_events() {
        UUID id = UUID.randomUUID();
        Entity entity = Entity.reconstitute(id, EntityTypeFixtures.MANGA.id(), "Berserk",
                Map.of(), List.of(), Set.of());

        assertTrue(entity.pullDomainEvents().isEmpty());
    }
}
