package com.iozycore.core.infrastructure.persistence.user;

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

    // Le seul droit qui distingue deux comptes, et il ne porte que sur
    // l'instance - jamais sur les données d'autrui (voir V28).
    @Column(name = "is_admin", nullable = false)
    private boolean admin;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AppUserJpaEntity() {
    }

    public AppUserJpaEntity(UUID id, String email, String passwordHash, String pseudo, boolean admin,
                             Instant createdAt) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.pseudo = pseudo;
        this.admin = admin;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getPseudo() { return pseudo; }
    public boolean isAdmin() { return admin; }
    public Instant getCreatedAt() { return createdAt; }
}
