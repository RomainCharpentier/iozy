package com.iozycore.core.testing;

import com.iozycore.core.application.insights.OwnedWorks;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;

import java.time.LocalDate;
import java.util.List;

/** Builds {@link OwnedWorks} for discovery tests without Spring. */
public final class OwnedWorksFixtures {

    private OwnedWorksFixtures() {
    }

    /**
     * The current account owns every entity of the repository, including the
     * ones saved after this call: most discovery tests only care about the
     * catalog they build.
     */
    public static OwnedWorks everythingOwnedIn(InMemoryEntityRepository entities) {
        InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository() {
            @Override
            public List<Ownership> findAll() {
                return entities.all().stream().map(OwnedWorksFixtures::owned).toList();
            }
        };
        return new OwnedWorks(entities, ownerships);
    }

    /** An active ownership of this entity by the current account. */
    public static Ownership owned(Entity entity) {
        return Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
    }
}
