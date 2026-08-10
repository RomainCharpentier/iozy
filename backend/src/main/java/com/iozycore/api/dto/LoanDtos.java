package com.iozycore.api.dto;

import com.iozycore.domain.loan.Loan;

import java.time.LocalDate;
import java.util.UUID;

public final class LoanDtos {

    private LoanDtos() {
    }

    public record LendRequest(UUID ownershipId, String borrowerName, LocalDate lentAt, String note) {
    }

    public record LoanResponse(UUID id, UUID ownershipId, String borrowerName, LocalDate lentAt, LocalDate returnedAt, String note) {
        public static LoanResponse from(Loan loan) {
            return new LoanResponse(loan.id(), loan.ownershipId(), loan.borrowerName(), loan.lentAt(),
                    loan.returnedAt().orElse(null), loan.note());
        }
    }

    /** Réponse enrichie pour "Prêts en cours" (Mon profil) - Loan ne connaît que l'Ownership prêtée,
     * ce join (entité/tome) est de la présentation pure, jamais stocké côté domaine. */
    public record ActiveLoanResponse(UUID id, UUID ownershipId, UUID entityId, String entityTitle,
                                      String variantLabel, String borrowerName, LocalDate lentAt, String note) {
    }
}
