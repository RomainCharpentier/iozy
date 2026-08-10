package com.iozycore.infrastructure.persistence.loan;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "loan")
public class LoanJpaEntity {

    @Id
    private UUID id;

    @Column(name = "ownership_id", nullable = false)
    private UUID ownershipId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "borrower_name", nullable = false)
    private String borrowerName;

    @Column(name = "lent_at", nullable = false)
    private LocalDate lentAt;

    @Column(name = "returned_at")
    private LocalDate returnedAt;

    private String note;

    protected LoanJpaEntity() {
    }

    public LoanJpaEntity(UUID id, UUID ownershipId, UUID ownerId, String borrowerName, LocalDate lentAt,
                          LocalDate returnedAt, String note) {
        this.id = id;
        this.ownershipId = ownershipId;
        this.ownerId = ownerId;
        this.borrowerName = borrowerName;
        this.lentAt = lentAt;
        this.returnedAt = returnedAt;
        this.note = note;
    }

    public UUID getId() { return id; }
    public UUID getOwnershipId() { return ownershipId; }
    public UUID getOwnerId() { return ownerId; }
    public String getBorrowerName() { return borrowerName; }
    public LocalDate getLentAt() { return lentAt; }
    public LocalDate getReturnedAt() { return returnedAt; }
    public String getNote() { return note; }
}
