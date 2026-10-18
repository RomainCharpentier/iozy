package com.iozycore.core.domain.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository {

    AppUser save(AppUser user);

    /** The address is normalized by the caller (see {@link AppUser#normaliserEmail}). */
    Optional<AppUser> findByEmail(String email);

    /**
     * The account that carries this pseudo, ignoring case - which makes uniqueness
     * CHECKABLE before writing, rather than through an index violation
     * that the user would not understand at all.
     */
    Optional<AppUser> findByPseudo(String pseudo);

    Optional<AppUser> findById(UUID id);

    /** True as long as no account exists: this is what opens the creation of the first one. */
    boolean isEmpty();

    /**
     * All accounts, from the oldest to the newest - the order in which an
     * instance filled up, and the only one that makes sense here.
     * <p>
     * Reserved to the administration of the instance (see {@code GestionDesComptes}):
     * an ordinary account has no reason to know who else exists.
     */
    List<AppUser> lister();

    /** Removes the account itself. Its DATA is deleted elsewhere, and before
     *  (see {@code SuppressionDeCompte}): this port only knows the accounts table. */
    void supprimer(UUID id);
}
