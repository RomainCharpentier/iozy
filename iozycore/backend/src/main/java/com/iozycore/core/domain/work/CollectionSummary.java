package com.iozycore.core.domain.work;

import java.util.List;
import java.util.UUID;

/**
 * How many objects the collection holds, and how many came in this month.
 *
 * <p><b>One definition of an object, for every screen</b>: one copy the account
 * owns today - an active ownership. A volume, a game box, a work owned as one
 * piece: each copy counts once, two copies of the same volume count twice.
 * Wishes, followed works, sold and lost copies are not objects, and neither
 * are works (a series of 12 owned volumes is 12 objects).
 *
 * <p>"Added this month" counts the active ownerships created in the current
 * calendar month (when they entered the app, not the purchase date the collector typed).
 */
public record CollectionSummary(long totalObjects, long addedThisMonth, List<TypeCount> addedThisMonthByType,
                                List<TypeCount> byType) {

    public record TypeCount(UUID entityTypeId, long count) {
    }

    public CollectionSummary {
        addedThisMonthByType = List.copyOf(addedThisMonthByType);
        byType = List.copyOf(byType);
    }
}
