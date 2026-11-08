package com.iozycore.core.infrastructure.persistence.purchase;

import com.iozycore.core.domain.purchase.MonthlyBudget;
import com.iozycore.core.domain.purchase.MonthlyBudgetRepository;
import com.iozycore.core.infrastructure.multitenance.ProprietaireCourant;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

interface PurchaseBudgetJpaRepository extends JpaRepository<PurchaseBudgetJpaEntity, UUID> {

    // A derived query, so filtered by owner - never findById (loads by key, unfiltered).
    Optional<PurchaseBudgetJpaEntity> findFirstByOrderByUpdatedAtDesc();

    /**
     * Insert or update in one statement: two first saves at once (two tabs)
     * would otherwise fail on the unique owner. Native SQL, so the owner is
     * passed by hand: {@code @TenantId} does not apply here.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO purchase_budget (id, owner_id, monthly_amount, updated_at)
            VALUES (:id, :ownerId, :amount, :updatedAt)
            ON CONFLICT (owner_id)
            DO UPDATE SET monthly_amount = EXCLUDED.monthly_amount, updated_at = EXCLUDED.updated_at
            """, nativeQuery = true)
    void upsert(@Param("id") UUID id, @Param("ownerId") UUID ownerId, @Param("amount") BigDecimal amount,
                @Param("updatedAt") Instant updatedAt);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaMonthlyBudgetRepositoryAdapter implements MonthlyBudgetRepository {

    private final PurchaseBudgetJpaRepository jpaRepository;
    private final ProprietaireCourant owner;

    @Override
    public Optional<MonthlyBudget> find() {
        return jpaRepository.findFirstByOrderByUpdatedAtDesc().map(jpa ->
                MonthlyBudget.reconstitute(jpa.getId(), jpa.getOwnerId(), jpa.getMonthlyAmount(), jpa.getUpdatedAt()));
    }

    /** One budget per account: an existing row is updated, never duplicated. */
    @Override
    public MonthlyBudget save(MonthlyBudget budget) {
        jpaRepository.upsert(budget.id(), owner.resolveCurrentTenantIdentifier(), budget.amount(),
                budget.updatedAt() == null ? Instant.now() : budget.updatedAt());
        return find().orElseThrow();
    }

    /** Read first (filtered by owner), then delete that row: a delete by id ignores the owner. */
    @Override
    public void delete() {
        jpaRepository.findFirstByOrderByUpdatedAtDesc().ifPresent(jpaRepository::delete);
    }
}
