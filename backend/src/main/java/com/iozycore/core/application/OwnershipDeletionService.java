package com.iozycore.core.application;

import com.iozycore.core.domain.ownership.OwnershipRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Deletes an Ownership - the application seam where the rules for
 * deleting a copy live, symmetric counterpart of
 * {@link EntityDeletionService}.
 * <p>
 * Unlike the deletion of an Entity (blocked as long as the slightest
 * Ownership/Experience exists, never relaxed), deleting ONE specific
 * Ownership is an action explicitly asked for by the user (see
 * "Delete this copy", OwnershipsSection on the web side) - a copy
 * added by mistake, twice, or that we no longer want to track must
 * be able to disappear, unlike the catalog page itself.
 * <p>
 * <b>No guard anymore since the removal of loans.</b> This service refused
 * the deletion of an ownership referenced by a {@code Loan}, so
 * that a loan history never points to a vanished ownership.
 * The loan feature having been removed from the product (see
 * {@code V19__drop_loan.sql}), this rule had no purpose left: it
 * protected a concept that no longer exists, not data that is still there.
 * <p>
 * <b>Deleting an Ownership never deletes the cataloged Volume</b> that it
 * references: the Variant and the Entity survive, only the ownership
 * disappears. This is the invariant "Ranking is not Owning", asserted by
 * {@code OwnershipHttpContractTest.deletes_an_ownership_without_touching_its_variant}.
 * <p>
 * The deletion stays <b>idempotent</b>: an unknown or already deleted
 * id raises nothing, the route returns 204 in all cases.
 */
@Service
public class OwnershipDeletionService {

    private final OwnershipRepository ownershipRepository;

    public OwnershipDeletionService(OwnershipRepository ownershipRepository) {
        this.ownershipRepository = ownershipRepository;
    }

    public void delete(UUID ownershipId) {
        ownershipRepository.deleteById(ownershipId);
    }
}
