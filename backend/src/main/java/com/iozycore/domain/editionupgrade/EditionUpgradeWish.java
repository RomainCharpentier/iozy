package com.iozycore.domain.editionupgrade;

import com.iozycore.domain.shared.DefaultOwner;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Racine d'agrégat représentant l'envie de remplacer une édition déjà
 * possédée d'une série par une meilleure (Perfect, Deluxe, Collector...) -
 * "je possède déjà cette série, mais je recherche une meilleure édition
 * pour la remplacer". Distinct de WishlistEntry : ici l'utilisateur possède
 * déjà l'œuvre, ce n'est pas une envie d'acquisition de zéro.
 * <p>
 * Rattachée à l'Entity (la série), pas à une Ownership précise : le
 * remplacement vise l'ensemble de la série dans son édition actuelle, pas
 * un tome isolé.
 * <p>
 * Porte un ownerId (DefaultOwner.ID tant qu'aucun vrai système
 * multi-utilisateur n'existe) - même préparation que Ownership/WishlistEntry/Loan.
 */
public class EditionUpgradeWish {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final String currentEditionName;
    private final String desiredEditionName;
    private final String note;
    private final LocalDate addedAt;

    private EditionUpgradeWish(UUID id, UUID entityId, UUID ownerId, String currentEditionName,
                                String desiredEditionName, String note, LocalDate addedAt) {
        if (currentEditionName == null || currentEditionName.isBlank()) {
            throw new IllegalArgumentException("L'édition actuelle ne peut pas être vide");
        }
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        // Le trim se fait ICI, après la garde. Il vivait dans create(), où il
        // s'exécutait comme ARGUMENT du constructeur, donc avant elle : un
        // corps sans édition actuelle levait une NullPointerException et
        // ressortait en 500, la garde ci-dessus n'étant jamais atteinte.
        this.currentEditionName = currentEditionName.trim();
        this.desiredEditionName = desiredEditionName;
        this.note = note;
        this.addedAt = addedAt;
    }

    public static EditionUpgradeWish create(UUID entityId, String currentEditionName, String desiredEditionName,
                                              String note) {
        return new EditionUpgradeWish(UUID.randomUUID(), entityId, DefaultOwner.ID, currentEditionName,
                desiredEditionName, note, LocalDate.now());
    }

    public static EditionUpgradeWish reconstitute(UUID id, UUID entityId, UUID ownerId, String currentEditionName,
                                                    String desiredEditionName, String note, LocalDate addedAt) {
        return new EditionUpgradeWish(id, entityId, ownerId, currentEditionName, desiredEditionName, note, addedAt);
    }

    public UUID id() {
        return id;
    }

    public UUID entityId() {
        return entityId;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public String currentEditionName() {
        return currentEditionName;
    }

    public Optional<String> desiredEditionName() {
        return Optional.ofNullable(desiredEditionName);
    }

    public Optional<String> note() {
        return Optional.ofNullable(note);
    }

    public LocalDate addedAt() {
        return addedAt;
    }
}
