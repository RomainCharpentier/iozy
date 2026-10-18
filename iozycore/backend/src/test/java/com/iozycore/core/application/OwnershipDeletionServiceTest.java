package com.iozycore.core.application;

import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryOwnershipRepository;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * This service used to refuse deleting an ownership referenced by a
 * loan. Loans were removed from the product (see {@code V19__drop_loan.sql}),
 * so no guard remains - which these tests state explicitly,
 * so that removing a rule stays a verified fact and not an oversight noticed
 * later.
 */
class OwnershipDeletionServiceTest {

    private final InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
    private final OwnershipDeletionService service = new OwnershipDeletionService(ownershipRepository);

    @Test
    void an_ownership_is_deleted_on_demand() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);

        service.delete(ownership.id());

        assertThat(ownershipRepository.findById(ownership.id())).isEmpty();
    }

    @Test
    void deleting_an_unknown_ownership_is_silent_because_the_route_is_idempotent() {
        // DELETE /api/ownerships/{id} returns 204 for an unknown or
        // already deleted id. So this service must never throw for that reason.
        assertThatCode(() -> service.delete(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void deleting_one_ownership_leaves_the_others_untouched() {
        UUID entityId = UUID.randomUUID();
        Ownership supprime = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        Ownership conserve = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.USED, LocalDate.now(), null));

        service.delete(supprime.id());

        assertThat(ownershipRepository.findById(supprime.id())).isEmpty();
        assertThat(ownershipRepository.findById(conserve.id())).isPresent();
    }
}
