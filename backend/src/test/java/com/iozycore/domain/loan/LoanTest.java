package com.iozycore.domain.loan;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoanTest {

    @Test
    void lending_assigns_the_default_owner_and_starts_active() {
        Loan loan = Loan.lend(UUID.randomUUID(), "Alex", LocalDate.now(), null);

        assertEquals(DefaultOwner.ID, loan.ownerId());
        assertTrue(loan.isActive());
        assertTrue(loan.returnedAt().isEmpty());
    }

    @Test
    void borrower_name_is_trimmed_and_cannot_be_blank() {
        Loan loan = Loan.lend(UUID.randomUUID(), "  Alex  ", LocalDate.now(), null);

        assertEquals("Alex", loan.borrowerName());
        assertThrows(IllegalArgumentException.class, () -> Loan.lend(UUID.randomUUID(), "   ", LocalDate.now(), null));
    }

    @Test
    void marking_returned_makes_the_loan_inactive() {
        Loan loan = Loan.lend(UUID.randomUUID(), "Alex", LocalDate.now().minusDays(10), null);

        loan.markReturned(LocalDate.now());

        assertTrue(loan.returnedAt().isPresent());
        assertEquals(loan.returnedAt().get(), LocalDate.now());
        assertEquals(false, loan.isActive());
    }

    @Test
    void a_loan_cannot_be_marked_returned_twice() {
        Loan loan = Loan.lend(UUID.randomUUID(), "Alex", LocalDate.now(), null);
        loan.markReturned(LocalDate.now());

        assertThrows(IllegalStateException.class, () -> loan.markReturned(LocalDate.now()));
    }
}
