package com.iozycore.core.domain.user;

import java.util.List;
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

    /**
     * Tous les comptes, du plus ancien au plus récent - l'ordre dans lequel une
     * instance s'est peuplée, et le seul qui ait un sens ici.
     * <p>
     * Réservé à l'administration de l'instance (voir {@code GestionDesComptes}) :
     * un compte ordinaire n'a aucune raison de savoir qui d'autre existe.
     */
    List<AppUser> lister();

    /** Retire le compte lui-même. Ses DONNÉES se suppriment ailleurs, et avant
     *  (voir {@code SuppressionDeCompte}) : ce port ne connaît que la table des comptes. */
    void supprimer(UUID id);
}
