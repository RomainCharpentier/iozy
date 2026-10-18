package com.iozycore.core.domain.ownership;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
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
    void acquerir_ne_choisit_pas_de_proprietaire_la_session_le_fera() {
        // The domain does not know who writes, and must not guess: the
        // owner is set at write time, from the session (@TenantId,
        // see ProprietaireCourant). Hibernate even refuses an already
        // set value that would differ from its own.
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null,
                OwnershipCondition.NEW, LocalDate.now(), null);

        assertNull(ownership.ownerId());
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

    @Test
    void purchase_price_is_absent_by_default_never_guessed() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null,
                OwnershipCondition.NEW, LocalDate.now(), null);

        assertTrue(ownership.purchasePrice().isEmpty());
    }

    @Test
    void purchase_price_can_be_set_then_cleared() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null,
                OwnershipCondition.NEW, LocalDate.now(), null);

        ownership.updatePurchasePrice(new BigDecimal("14.90"));
        assertEquals(new BigDecimal("14.90"), ownership.purchasePrice().orElseThrow());

        ownership.updatePurchasePrice(null);
        assertTrue(ownership.purchasePrice().isEmpty());
    }

    // "Undo" offered just after "Mark sold"/"Mark lost" must not
    // be decorative: these two cases guarantee it really restores.
    @Test
    void a_sold_copy_can_be_restored_to_owned() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.USED, LocalDate.now(), null);
        ownership.markSold();
        assertFalse(ownership.isActive());

        ownership.restore();

        assertTrue(ownership.isActive());
    }

    @Test
    void a_lost_copy_can_be_restored_to_owned() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.USED, LocalDate.now(), null);
        ownership.markLost();

        ownership.restore();

        assertTrue(ownership.isActive());
    }

    @Test
    void restoring_an_already_active_copy_is_refused_rather_than_silently_ignored() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.NEW, LocalDate.now(), null);

        assertThrows(IllegalStateException.class, ownership::restore);
    }
}
