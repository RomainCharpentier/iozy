package com.iozycore.integration;

import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.purchase.PurchaseService;
import com.iozycore.core.domain.purchase.MonthlyBudget;
import com.iozycore.core.domain.purchase.MonthlyBudgetRepository;
import com.iozycore.core.domain.shared.DefaultOwner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The monthly budget of one account is nobody else's: another account sees
 * none, sets its own, and removing it touches only its own row.
 *
 * <p>Outside a transaction, like {@link WorksIsolationTest}: Hibernate reads
 * the owner when a session opens, so each call is its own request.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PurchaseBudgetIsolationTest extends PostgresIntegrationTest {

    private static final UUID ALICE = DefaultOwner.ID;
    private static final UUID BOB = UUID.randomUUID();

    @Autowired private PurchaseService purchases;
    @Autowired private MonthlyBudgetRepository budgets;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM purchase_budget WHERE owner_id IN (?, ?)", ALICE, BOB);
        SecurityContextHolder.clearContext();
    }

    private void signIn(UUID account) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetailsService.Principal(account, account + "@example.com", "{noop}x", "Compte", false),
                null, List.of()));
    }

    @Test
    void another_account_sees_none_of_the_budget_and_keeps_its_own() {
        signIn(ALICE);
        purchases.setBudget(new BigDecimal("150"));

        signIn(BOB);
        assertThat(purchases.budget()).isEmpty();
        purchases.setBudget(new BigDecimal("40"));
        assertThat(purchases.budget()).contains(new BigDecimal("40.00"));

        signIn(ALICE);
        assertThat(purchases.budget()).contains(new BigDecimal("150.00"));

        // Bob removes his budget: Alice's stays.
        signIn(BOB);
        purchases.setBudget(null);
        assertThat(purchases.budget()).isEmpty();
        signIn(ALICE);
        assertThat(purchases.budget()).contains(new BigDecimal("150.00"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM purchase_budget WHERE owner_id = ?", Long.class,
                ALICE)).isEqualTo(1L);
    }

    @Test
    void two_first_budgets_at_once_leave_one_row() {
        signIn(BOB);
        // Two tabs that both read no budget: each saves a new one, with its own id.
        budgets.save(MonthlyBudget.create(new BigDecimal("20"), Instant.now()));
        budgets.save(MonthlyBudget.create(new BigDecimal("25"), Instant.now()));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM purchase_budget WHERE owner_id = ?", Long.class,
                BOB)).isEqualTo(1L);
        assertThat(purchases.budget()).contains(new BigDecimal("25.00"));
    }
}
