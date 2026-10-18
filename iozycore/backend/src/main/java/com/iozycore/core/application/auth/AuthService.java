package com.iozycore.core.application.auth;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * Create an account - and decide who has the right to create one.
 *
 * <h2>The first account is not like the others</h2>
 * As long as no account exists, creation is <b>open</b>: someone has to be
 * able to enter first, and a freshly deployed instance
 * has nothing to protect. This first account <b>takes over</b> the id of the
 * default owner: the collection already entered becomes its own, without
 * a single row moving (see {@link AppUser#premier}).
 *
 * <h2>Then, by invitation only</h2>
 * A free sign-up on an application exposed to the Internet is a database
 * open to anyone. The following accounts therefore need an invitation
 * code, defined by the operator of the instance
 * ({@code IOZYCORE_INVITE_CODE}). <b>If not defined, creation is closed</b>:
 * the absence of configuration must never open a door - it closes it.
 *
 * <h2>The pseudo is checked HERE, not only in the database</h2>
 * The unique index of V27 guarantees that no duplicate is written; it does not
 * guarantee that it is explained. An index violation comes up as a 500, with a
 * message that talks about a constraint to someone who just wanted to choose a
 * name. The prior check exists for the SENTENCE, the index for
 * certainty - two distinct needs, and neither replaces the other.
 */
@Service
public class AuthService {

    /**
     * Ten characters, not eight. It is the only secret in front of a whole
     * collection, and there is no second factor behind it: the lower
     * bound might as well not be that of a safe opened with a blowtorch.
     */
    static final int LONGUEUR_MINIMALE_MOT_DE_PASSE = 10;

    /**
     * Deliberately permissive: an e-mail address is not validated by a
     * regular expression (the real grammar takes several pages), and
     * the only check that matters - "do you read it?" -
     * would require sending a message to it. So we refuse what is
     * obviously not an address, without claiming to validate the others.
     */
    private static final Pattern FORME_D_ADRESSE = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final AppUserRepository comptes;
    private final PasswordEncoder encodeur;
    private final String codeInvitation;

    public AuthService(AppUserRepository comptes, PasswordEncoder encodeur,
                       @Value("${auth.invite-code:}") String codeInvitation) {
        this.comptes = comptes;
        this.encodeur = encodeur;
        this.codeInvitation = codeInvitation == null ? "" : codeInvitation.trim();
    }

    /** True as long as nobody has created an account: the client then offers "create the first account". */
    public boolean aucunCompte() {
        return comptes.isEmpty();
    }

    /** True if one more account can be created - first account, or invitation code configured. */
    public boolean creationOuverte() {
        return aucunCompte() || !codeInvitation.isEmpty();
    }

    public AppUser creer(String email, String motDePasse, String pseudo, String codeFourni) {
        String adresse = AppUser.normaliserEmail(email);
        if (!FORME_D_ADRESSE.matcher(adresse).matches()) {
            throw new CreationRefusee("Cette adresse e-mail n'a pas une forme valide.");
        }
        if (motDePasse == null || motDePasse.length() < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
            throw new CreationRefusee(
                    "Le mot de passe doit faire au moins " + LONGUEUR_MINIMALE_MOT_DE_PASSE + " caractères.");
        }
        String nom = pseudo == null ? "" : pseudo.trim();
        if (!AppUser.estUnPseudoValide(nom)) {
            throw new CreationRefusee("Le pseudo doit faire 3 à 24 caractères, sans espace ni arobase, "
                    + "et commencer par une lettre ou un chiffre.");
        }

        boolean premier = comptes.isEmpty();
        if (!premier) {
            if (codeInvitation.isEmpty()) {
                throw new CreationInterdite("La création de compte est fermée sur cette instance.");
            }
            if (!codeInvitation.equals(codeFourni == null ? "" : codeFourni.trim())) {
                throw new CreationInterdite("Code d'invitation invalide.");
            }
        }

        if (comptes.findByEmail(adresse).isPresent()) {
            throw new CreationRefusee("Un compte existe déjà avec cette adresse.");
        }
        if (comptes.findByPseudo(nom).isPresent()) {
            throw new CreationRefusee("Ce pseudo est déjà pris.");
        }

        String hache = encodeur.encode(motDePasse);
        AppUser compte = premier
                ? AppUser.premier(adresse, hache, nom)
                : AppUser.nouveau(adresse, hache, nom);
        return comptes.save(compte);
    }

    /** A badly formed request: the user can fix it (400). */
    public static class CreationRefusee extends RuntimeException {
        public CreationRefusee(String message) {
            super(message);
        }
    }

    /** A well-formed request, but not allowed here (403). */
    public static class CreationInterdite extends RuntimeException {
        public CreationInterdite(String message) {
            super(message);
        }
    }
}
