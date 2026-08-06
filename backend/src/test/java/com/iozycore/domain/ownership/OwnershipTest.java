package com.iozycore.domain.ownership;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OwnershipTest {

    @Test
    void acquiring_raises_ownership_added_event() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null,
                OwnershipCondition.NEW, LocalDate.now(), "Acheté en librairie");

        assertEquals(1, ownership.pullDomainEvents().size());
        assertTrue(ownership.isActive());
    }

    @Test
    void acquiring_assigns_the_default_owner_until_multi_user_exists() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null,
                OwnershipCondition.NEW, LocalDate.now(), null);

        assertEquals(DefaultOwner.ID, ownership.ownerId());
    }

    @Test
    void marking_sold_releases_ownership_and_raises_event() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null,
                OwnershipCondition.USED, LocalDate.now(), null);
        ownership.pullDomainEvents();

        ownership.markSold();

        assertEquals(OwnershipStatus.SOLD, ownership.status());
        assertEquals(1, ownership.pullDomainEvents().size());
    }

    @Test
    void a_released_ownership_cannot_be_released_again() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null,
                OwnershipCondition.NEW, LocalDate.now(), null);
        ownership.markLost();

        assertThrows(IllegalStateException.class, ownership::markSold);
    }

    @Test
    void an_ownership_may_reference_a_specific_variant() {
        UUID variantId = UUID.randomUUID();
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), variantId,
                OwnershipCondition.NEW, LocalDate.now(), null);

        assertEquals(variantId, ownership.variantId().orElseThrow());
    }
}
