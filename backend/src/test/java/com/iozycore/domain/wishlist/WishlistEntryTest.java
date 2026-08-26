package com.iozycore.domain.wishlist;

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

    // Sans cette garde, un corps sans entityId descendait jusqu'à Hibernate, qui
    // remontait sa violation de contrainte en 500 - requête SQL comprise (Lot 28).
    @Test
    void an_entry_without_an_entity_is_refused_before_reaching_the_database() {
        assertThrows(IllegalArgumentException.class, () -> WishlistEntry.add(null, LocalDate.now()));
    }

    // reconstitute() relit ce que la base contient déjà : elle ne crée rien et
    // n'a donc pas à se défendre du même corps de requête incomplet.
    @Test
    void reconstituting_an_existing_entry_records_no_event() {
        WishlistEntry entry = WishlistEntry.reconstitute(
                UUID.randomUUID(), UUID.randomUUID(), null, UUID.randomUUID(), LocalDate.now());

        assertEquals(0, entry.pullDomainEvents().size());
    }
}
