package com.iozycore.core.domain.wishlist;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WishlistEntryTest {

    @Test
    void adding_an_entry_records_a_domain_event() {
        UUID entityId = UUID.randomUUID();

        WishlistEntry entry = WishlistEntry.add(entityId, LocalDate.now());

        assertEquals(entityId, entry.entityId());
        assertEquals(1, entry.pullDomainEvents().size());
    }

    // Without this guard, a body without entityId went down to Hibernate, which
    // raised its constraint violation as a 500 - SQL query included (Batch 28).
    @Test
    void an_entry_without_an_entity_is_refused_before_reaching_the_database() {
        assertThrows(IllegalArgumentException.class, () -> WishlistEntry.add(null, LocalDate.now()));
    }

    // reconstitute() re-reads what the database already holds: it creates nothing and
    // so does not have to defend against the same incomplete request body.
    @Test
    void reconstituting_an_existing_entry_records_no_event() {
        WishlistEntry entry = WishlistEntry.reconstitute(
                UUID.randomUUID(), UUID.randomUUID(), null, UUID.randomUUID(), LocalDate.now());

        assertEquals(0, entry.pullDomainEvents().size());
    }
}
