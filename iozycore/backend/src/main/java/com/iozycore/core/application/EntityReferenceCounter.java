package com.iozycore.core.application;

import java.util.UUID;

/**
 * Port of the core: counts every row that still points to a work, across
 * ALL accounts.
 *
 * <p>The JPA repositories cannot do it: they only see the current account
 * ({@code @TenantId}). But a row of another account still blocks the
 * deletion through its foreign key, and without this count the user would
 * get a raw SQL error instead of a clear reason.
 */
public interface EntityReferenceCounter {

    EntityReferences count(UUID entityId);

    /**
     * What still holds a work, all accounts together.
     *
     * @param follows accounts that follow the work or one of its editions
     * @param links relationships where the work is the source or the target
     */
    record EntityReferences(long ownerships, long experiences, long wishes, long follows, long links) {

        public static final EntityReferences NONE = new EntityReferences(0, 0, 0, 0, 0);

        public boolean any() {
            return ownerships + experiences + wishes + follows + links > 0;
        }
    }
}
