package com.iozycore.domain.ownership;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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

    // "Annuler" propose juste apres "Marquer vendu"/"Marquer perdu" ne doit pas
    // etre decoratif : ces deux cas garantissent qu'il restaure vraiment.
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
