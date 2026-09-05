package com.iozycore.core.domain.catalog;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RelationshipTest {

    @Test
    void a_relationship_links_two_distinct_entities() {
        UUID source = UUID.randomUUID();
        UUID target = UUID.randomUUID();

        Relationship relationship = new Relationship(UUID.randomUUID(), source, target, "ADAPTED_INTO");

        assertEquals(source, relationship.sourceEntityId());
        assertEquals(target, relationship.targetEntityId());
    }

    @Test
    void an_entity_cannot_be_related_to_itself() {
        UUID entityId = UUID.randomUUID();

        assertThrows(IllegalArgumentException.class,
                () -> new Relationship(UUID.randomUUID(), entityId, entityId, "PART_OF_SERIES"));
    }

    @Test
    void relationship_type_cannot_be_blank() {
        assertThrows(IllegalArgumentException.class,
                () -> new Relationship(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), " "));
    }

    // Les deux suivants : un corps de requête incomplet arrivait jusqu'au
    // .equals() du constructeur compact et remontait une NullPointerException
    // en 500, là où l'appelant avait simplement omis un champ (Lot 28).
    @Test
    void a_missing_source_is_refused_rather_than_dereferenced() {
        assertThrows(IllegalArgumentException.class,
                () -> new Relationship(UUID.randomUUID(), null, UUID.randomUUID(), "ADAPTED_INTO"));
    }

    @Test
    void a_missing_target_is_refused_rather_than_dereferenced() {
        assertThrows(IllegalArgumentException.class,
                () -> new Relationship(UUID.randomUUID(), UUID.randomUUID(), null, "ADAPTED_INTO"));
    }
}
