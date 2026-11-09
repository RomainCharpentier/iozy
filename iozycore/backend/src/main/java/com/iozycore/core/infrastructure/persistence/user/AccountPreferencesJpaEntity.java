package com.iozycore.core.infrastructure.persistence.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "account_preferences")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class AccountPreferencesJpaEntity {

    @Id
    private UUID id;

    // Isolation by owner: Hibernate adds this column to every query and fills
    // it on insert (ProprietaireCourant).
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "accent")
    private String accent;

    @Column(name = "appearance")
    private String appearance;

    @Column(name = "title_composition")
    private String titleComposition;

    @Column(name = "blindtest_sound_enabled")
    private Boolean blindtestSoundEnabled;

    @Column(name = "blindtest_sound_volume")
    private Short blindtestSoundVolume;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
