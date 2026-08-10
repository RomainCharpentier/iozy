package com.iozycore.infrastructure.persistence.editionupgrade;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "edition_upgrade_wish")
public class EditionUpgradeWishJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_id", nullable = false)
    private UUID entityId;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "current_edition_name", nullable = false)
    private String currentEditionName;

    @Column(name = "desired_edition_name")
    private String desiredEditionName;

    private String note;

    @Column(name = "added_at", nullable = false)
    private LocalDate addedAt;

    protected EditionUpgradeWishJpaEntity() {
    }

    public EditionUpgradeWishJpaEntity(UUID id, UUID entityId, UUID ownerId, String currentEditionName,
                                        String desiredEditionName, String note, LocalDate addedAt) {
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.currentEditionName = currentEditionName;
        this.desiredEditionName = desiredEditionName;
        this.note = note;
        this.addedAt = addedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityId() { return entityId; }
    public UUID getOwnerId() { return ownerId; }
    public String getCurrentEditionName() { return currentEditionName; }
    public String getDesiredEditionName() { return desiredEditionName; }
    public String getNote() { return note; }
    public LocalDate getAddedAt() { return addedAt; }
}
