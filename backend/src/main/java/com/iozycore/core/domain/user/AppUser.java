package com.iozycore.core.domain.user;

import com.iozycore.core.domain.shared.DefaultOwner;

import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * An account, and nothing else.
 *
 * <h2>One single distinction, and what it does NOT give</h2>
 * No role, no permission, no status: one single flag, {@code admin}. All
 * accounts can do exactly the same on the data - each one on ITS OWN
 * collection. What administration adds only concerns the <b>instance</b>
 * : seeing who has an account, and deleting one. <b>An administrator has no
 * access to anyone's collection</b> - the isolation by owner
 * is intact, and nothing here opens it.
 * <p>
 * A boolean rather than a roles table: there is only one distinction to
 * make, and a machinery with two possible values whose second line
 * nobody would ever read.
 *
 * <h2>The id IS the owner</h2>
 * The {@code owner_id} columns exist since migration V2, filled
 * with {@link DefaultOwner#ID}. An account therefore does not need a second
 * id: its {@code id} is the one that will be found in these columns.
 * This is what lets the very first account <b>take over</b> the data
 * already in the database by adopting this id, without a single row moving.
 *
 * @param email        stored in lowercase and without edge spaces - two accounts
 *                     cannot differ by case alone
 * @param passwordHash the hash, never the password. This record travels through
 *                     the application; the plain password only lives
 *                     for the time of one call to the encoder
 * @param admin        can administer the INSTANCE (see migration V28), not
 *                     the data of others. The first account is one; the
 *                     next ones only become one through SQL
 * @param pseudo       the only name under which a person appears. Unique
 *                     (see migration V27), required, and never
 *                     the e-mail address: it is used to log in, not to
 *                     be shown. <b>Set at sign-up</b> and never
 *                     changed - a product decision, not a feature
 *                     put off for later: a pseudo that can be taken over
 *                     designates someone else tomorrow, and no surface that
 *                     displayed it will know. No route writes it after
 *                     {@code POST /api/auth/register}
 */
public record AppUser(UUID id, String email, String passwordHash, String pseudo, boolean admin,
                       Instant createdAt) {

    /**
     * What a pseudo is allowed to be.
     *
     * <h2>Three to twenty-four characters</h2>
     * Below three, it no longer tells anything apart; above twenty-four,
     * it no longer fits in the places that display it, starting with
     * the avatar of the menu.
     *
     * <h2>Letters, digits, and three separators</h2>
     * <b>Accents are accepted</b> ({@code \p{L}} and not {@code [a-z]}):
     * refusing "Rémi" in a French application would be a technical
     * rule disguised as a product rule. Refused are the space - which makes
     * two pseudos indistinguishable by eye, "jean dupont" and
     * "jean  dupont" - and the at sign, which would make a pseudo pass for an
     * address.
     *
     * <h2>It starts with a letter or a digit</h2>
     * Otherwise {@code ...} and {@code ---} would be valid pseudos, and two
     * people would be told apart by a pattern that nobody can read
     * out loud.
     */
    private static final Pattern FORME_DE_PSEUDO =
            Pattern.compile("^[\\p{L}\\p{N}][\\p{L}\\p{N}._-]{2,23}$", Pattern.UNICODE_CHARACTER_CLASS);

    public AppUser {
        if (id == null) {
            throw new IllegalArgumentException("Un compte doit porter un identifiant");
        }
        email = normaliserEmail(email);
        if (email.isEmpty()) {
            throw new IllegalArgumentException("Un compte doit porter une adresse e-mail");
        }
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new IllegalArgumentException("Un compte doit porter un mot de passe haché");
        }
        pseudo = pseudo == null ? "" : pseudo.trim();
        if (!estUnPseudoValide(pseudo)) {
            throw new IllegalArgumentException("Un compte doit porter un pseudo valide");
        }
        createdAt = createdAt == null ? Instant.now() : createdAt;
    }

    /**
     * True when this text can be used as a pseudo.
     * <p>
     * Public because the door must be able to <b>explain</b> a refusal to
     * the user (400 with a sentence) rather than let a construction
     * exception come up, which is never meant to be read.
     */
    public static boolean estUnPseudoValide(String pseudo) {
        return pseudo != null && FORME_DE_PSEUDO.matcher(pseudo.trim()).matches();
    }

    /**
     * The form in which two pseudos are compared: case does not tell
     * two people apart, exactly like for the address (see migration
     * V27, which sets the unique index on {@code lower(pseudo)}).
     */
    public static String normaliserPseudo(String pseudo) {
        return pseudo == null ? "" : pseudo.trim().toLowerCase();
    }

    /**
     * The form in which an address is compared and stored.
     * <p>
     * Public because the comparison is also done at read time (looking up
     * an account by the address typed on the keyboard): two normalizations
     * written separately would end up different, and a user would
     * see their own address refused because of a capital letter.
     */
    public static String normaliserEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    /**
     * The very first account adopts the id of the default owner:
     * the collection already entered becomes its own. The next ones get a
     * new id, so an empty collection.
     */
    public static AppUser premier(String email, String passwordHash, String pseudo) {
        // Administrator by default: on a new instance, nobody else
        // could become one, and the administration screen would have no
        // opener. See also V28, which does the same on instances
        // already in service.
        return new AppUser(DefaultOwner.ID, email, passwordHash, pseudo, true, Instant.now());
    }

    public static AppUser nouveau(String email, String passwordHash, String pseudo) {
        return new AppUser(UUID.randomUUID(), email, passwordHash, pseudo, false, Instant.now());
    }
}
