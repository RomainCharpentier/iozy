package com.iozycore.infrastructure.persistence.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class AppUserJpaEntity {

    @Id
    private UUID id;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // Unique sans tenir compte de la casse, par un index fonctionnel posé en
    // V27 (`lower(pseudo)`) : `unique = true` ici décrirait une unicité
    // sensible à la casse, que la base n'applique pas.
    @Column(name = "pseudo", nullable = false)
    private String pseudo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AppUserJpaEntity() {
    }

    public AppUserJpaEntity(UUID id, String email, String passwordHash, String pseudo, Instant createdAt) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.pseudo = pseudo;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getPseudo() { return pseudo; }
    public Instant getCreatedAt() { return createdAt; }
}
