package com.iozycore.core.domain.purchase;

import java.util.Optional;

/** The budget of the current account - separated by owner, like the wishes. */
public interface MonthlyBudgetRepository {

    Optional<MonthlyBudget> find();

    MonthlyBudget save(MonthlyBudget budget);

    /** Removes the budget of the current account. Idempotent. */
    void delete();
}
