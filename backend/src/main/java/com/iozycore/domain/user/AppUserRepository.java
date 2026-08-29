package com.iozycore.domain.user;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository {

    AppUser save(AppUser user);

    /** L'adresse est normalisée par l'appelant (voir {@link AppUser#normaliserEmail}). */
    Optional<AppUser> findByEmail(String email);

    /**
     * Le compte qui porte ce pseudo, à la casse près - ce qui rend l'unicité
     * VÉRIFIABLE avant d'écrire, plutôt qu'à travers une violation d'index
     * dont l'utilisateur ne comprendrait rien.
     */
    Optional<AppUser> findByPseudo(String pseudo);

    Optional<AppUser> findById(UUID id);

    /** Vrai tant qu'aucun compte n'existe : c'est ce qui ouvre la création du premier. */
    boolean isEmpty();
}
