package com.iozycore.core.application.admin;

import java.util.Map;
import java.util.UUID;

/**
 * What each account weighs, and how to erase one's own.
 *
 * <h2>The only place in the application that looks over the partition</h2>
 * Everywhere else, a query only sees the rows of the current owner
 * - Hibernate enforces it, through the {@code @TenantId} filter, and this is
 * what makes isolation true rather than promised (see Batch 95). The two
 * actions below cannot be written that way: counting the ownerships of
 * SOMEONE ELSE, or erasing one's own, is precisely going out of one's
 * own partition.
 *
 * <p>Hence a separate port, and an implementation in direct SQL: this is not
 * a discreet workaround slipped into an ordinary repository, it is a named
 * door, with a single caller ({@link GestionDesComptes}) and a guard
 * in front (the {@code ADMIN} role, see {@code SecurityConfig}).
 *
 * <h2>NUMBERS, never content</h2>
 * {@link #compter()} returns counts. No method here returns a row:
 * an administrator must be able to decide whether to delete an account - so know
 * what it destroys - without ever reading anyone's collection.
 */
public interface DonneesParProprietaire {

    /**
     * @param possessions the volumes and items really owned
     * @param envies      the wishlist
     * @param experiences readings, games, viewings - what was lived
     * @param classements the personal Tier Lists
     * @param analyses    the saved listing analyses
     */
    record Volume(long possessions, long envies, long experiences, long classements, long analyses) {

        public static final Volume AUCUN = new Volume(0, 0, 0, 0, 0);

        /** What would be destroyed by deleting this account - zero means "nothing". */
        public long total() {
            return possessions + envies + experiences + classements + analyses;
        }
    }

    /**
     * The volume of each owner, in a single query.
     * <p>
     * One query per account would make the cost of the screen grow with the number
     * of accounts, for a screen that lists them all - the exact figure of
     * finding C1.
     */
    Map<UUID, Volume> compter();

    /**
     * Erases EVERYTHING that belongs to this owner, in the eleven tables that
     * carry an {@code owner_id}. The account itself is removed elsewhere (see
     * {@code AppUserRepository#supprimer}): this method only knows the
     * data.
     * <p>
     * The catalog - works, volumes, editions, relationships - is NOT touched: it
     * is shared, a work is the same for everyone, and deleting it
     * would remove it from the collection of the others.
     */
    void effacerToutCeQuiAppartientA(UUID proprietaire);
}
