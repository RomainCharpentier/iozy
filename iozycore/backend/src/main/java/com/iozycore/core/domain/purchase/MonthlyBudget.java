package com.iozycore.core.domain.purchase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * The monthly purchase budget of one account (lot 216). Optional: no budget
 * is said by having none, never by a zero. Private to the account: the owner
 * is set by the persistence from the session.
 */
public final class MonthlyBudget {

    /** Above this, the amount is a typing slip, not a budget. */
    public static final BigDecimal MAX_AMOUNT = new BigDecimal("100000.00");

    private final UUID id;
    private final UUID ownerId;
    private final BigDecimal amount;
    private final Instant updatedAt;

    private MonthlyBudget(UUID id, UUID ownerId, BigDecimal amount, Instant updatedAt) {
        this.id = Objects.requireNonNull(id, "id");
        this.ownerId = ownerId;
        this.amount = Objects.requireNonNull(amount, "amount");
        this.updatedAt = updatedAt;
    }

    /**
     * A new budget.
     *
     * @throws IllegalArgumentException the amount is not strictly positive, or absurdly high
     */
    public static MonthlyBudget create(BigDecimal amount, Instant now) {
        return new MonthlyBudget(UUID.randomUUID(), null, checked(amount), now);
    }

    public static MonthlyBudget reconstitute(UUID id, UUID ownerId, BigDecimal amount, Instant updatedAt) {
        return new MonthlyBudget(id, ownerId, amount, updatedAt);
    }

    /** The same budget with a new amount: one budget per account. */
    public MonthlyBudget changeTo(BigDecimal newAmount, Instant now) {
        return new MonthlyBudget(id, ownerId, checked(newAmount), now);
    }

    private static BigDecimal checked(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Le budget doit être un montant positif, en euros");
        }
        if (amount.compareTo(MAX_AMOUNT) > 0) {
            throw new IllegalArgumentException("Le budget du mois ne peut pas dépasser 100 000 €");
        }
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    public UUID id() {
        return id;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public BigDecimal amount() {
        return amount;
    }

    public Instant updatedAt() {
        return updatedAt;
    }
}
