package com.iozycore.domain.loan;

import com.iozycore.domain.shared.DefaultOwner;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Racine d'agrégat représentant le prêt d'une possession précise
 * (Ownership) à quelqu'un - "à qui un manga ou un jeu a été prêté".
 * Rattachée à l'Ownership plutôt qu'à l'Entity : si plusieurs exemplaires
 * du même tome sont possédés, seul celui réellement prêté doit apparaître
 * emprunté, pas toute la fiche.
 * <p>
 * Porte un ownerId (DefaultOwner.ID tant qu'aucun vrai système
 * multi-utilisateur n'existe) - même préparation que Ownership/WishlistEntry,
 * voir DefaultOwner.
 */
public class Loan {

    private final UUID id;
    private final UUID ownershipId;
    private final UUID ownerId;
    private final String borrowerName;
    private final LocalDate lentAt;
    private LocalDate returnedAt;
    private final String note;

    private Loan(UUID id, UUID ownershipId, UUID ownerId, String borrowerName, LocalDate lentAt,
                  LocalDate returnedAt, String note) {
        if (borrowerName == null || borrowerName.isBlank()) {
            throw new IllegalArgumentException("Le nom de l'emprunteur ne peut pas être vide");
        }
        this.id = id;
        this.ownershipId = ownershipId;
        this.ownerId = ownerId;
        this.borrowerName = borrowerName;
        this.lentAt = lentAt;
        this.returnedAt = returnedAt;
        this.note = note;
    }

    public static Loan lend(UUID ownershipId, String borrowerName, LocalDate lentAt, String note) {
        return new Loan(UUID.randomUUID(), ownershipId, DefaultOwner.ID, borrowerName.trim(), lentAt, null, note);
    }

    public static Loan reconstitute(UUID id, UUID ownershipId, UUID ownerId, String borrowerName, LocalDate lentAt,
                                     LocalDate returnedAt, String note) {
        return new Loan(id, ownershipId, ownerId, borrowerName, lentAt, returnedAt, note);
    }

    public void markReturned(LocalDate returnedAt) {
        if (this.returnedAt != null) {
            throw new IllegalStateException("Ce prêt est déjà marqué comme rendu");
        }
        this.returnedAt = returnedAt;
    }

    public boolean isActive() {
        return returnedAt == null;
    }

    public UUID id() {
        return id;
    }

    public UUID ownershipId() {
        return ownershipId;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public String borrowerName() {
        return borrowerName;
    }

    public LocalDate lentAt() {
        return lentAt;
    }

    public Optional<LocalDate> returnedAt() {
        return Optional.ofNullable(returnedAt);
    }

    public String note() {
        return note;
    }
}
