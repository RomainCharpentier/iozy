package com.iozycore.core.infrastructure.persistence.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class AppUserJpaEntity {

    @Id
    private UUID id;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // Unique regardless of case, through a functional index created in
    // V27 (`lower(pseudo)`): `unique = true` here would describe a
    // case-sensitive uniqueness, which the database does not enforce.
    @Column(name = "pseudo", nullable = false)
    private String pseudo;

    // The only right that tells two accounts apart, and it only applies to
    // the instance - never to the data of others (see V28).
    @Column(name = "is_admin", nullable = false)
    private boolean admin;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public AppUserJpaEntity(UUID id, String email, String passwordHash, String pseudo, boolean admin,
                             Instant createdAt) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.pseudo = pseudo;
        this.admin = admin;
        this.createdAt = createdAt;
    }

    public boolean isAdmin() { return admin; }
}
