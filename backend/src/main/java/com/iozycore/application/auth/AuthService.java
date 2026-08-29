package com.iozycore.application.auth;

import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

/**
 * Créer un compte — et décider qui a le droit d'en créer un.
 *
 * <h2>Le premier compte n'est pas comme les autres</h2>
 * Tant qu'aucun compte n'existe, la création est <b>ouverte</b> : il faut bien
 * que quelqu'un puisse entrer le premier, et une instance fraîchement déployée
 * n'a rien à protéger. Ce premier compte <b>reprend</b> l'identifiant du
 * propriétaire par défaut : la collection déjà saisie devient la sienne, sans
 * qu'une seule ligne ne bouge (voir {@link AppUser#premier}).
 *
 * <h2>Ensuite, sur invitation seulement</h2>
 * Une inscription libre sur une application exposée à Internet, c'est une base
 * ouverte à n'importe qui. Les comptes suivants demandent donc un code
 * d'invitation, défini par l'exploitant de l'instance
 * ({@code IOZYCORE_INVITE_CODE}). <b>Non défini, la création est fermée</b> :
 * l'absence de configuration ne doit jamais ouvrir une porte - elle la ferme.
 */
@Service
public class AuthService {

    /**
     * Dix caractères, et non huit. C'est le seul secret devant toute une
     * collection, et il n'y a pas de second facteur derrière : autant que la
     * borne basse ne soit pas celle d'un coffre qu'on ouvre au chalumeau.
     */
    static final int LONGUEUR_MINIMALE_MOT_DE_PASSE = 10;

    /**
     * Volontairement permissif : une adresse e-mail ne se valide pas par une
     * expression régulière (la vraie grammaire tient sur plusieurs pages), et
     * la seule vérification qui compte - « est-ce que tu la relèves ? » -
     * demanderait d'y envoyer un message. On refuse donc ce qui n'est
     * manifestement pas une adresse, sans prétendre valider les autres.
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

    /** Vrai tant que personne n'a créé de compte : le client propose alors « créer le premier compte ». */
    public boolean aucunCompte() {
        return comptes.isEmpty();
    }

    /** Vrai si un compte de plus peut être créé - premier compte, ou code d'invitation configuré. */
    public boolean creationOuverte() {
        return aucunCompte() || !codeInvitation.isEmpty();
    }

    public AppUser creer(String email, String motDePasse, String nomAffiche, String codeFourni) {
        String adresse = AppUser.normaliserEmail(email);
        if (!FORME_D_ADRESSE.matcher(adresse).matches()) {
            throw new CreationRefusee("Cette adresse e-mail n'a pas une forme valide.");
        }
        if (motDePasse == null || motDePasse.length() < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
            throw new CreationRefusee(
                    "Le mot de passe doit faire au moins " + LONGUEUR_MINIMALE_MOT_DE_PASSE + " caractères.");
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

        String hache = encodeur.encode(motDePasse);
        AppUser compte = premier
                ? AppUser.premier(adresse, hache, nomAffiche)
                : AppUser.nouveau(adresse, hache, nomAffiche);
        return comptes.save(compte);
    }

    /** Une demande mal formée : l'utilisateur peut la corriger (400). */
    public static class CreationRefusee extends RuntimeException {
        public CreationRefusee(String message) {
            super(message);
        }
    }

    /** Une demande bien formée, mais pas autorisée ici (403). */
    public static class CreationInterdite extends RuntimeException {
        public CreationInterdite(String message) {
            super(message);
        }
    }
}
