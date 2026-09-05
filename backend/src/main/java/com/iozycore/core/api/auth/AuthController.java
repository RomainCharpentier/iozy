package com.iozycore.core.api.auth;

import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.auth.AuthService;
import com.iozycore.core.application.auth.Invite;
import com.iozycore.core.application.auth.Visite;
import com.iozycore.core.domain.user.AppUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Entrer, sortir, et savoir qui l'on est.
 *
 * <h2>Quatre routes ouvertes, et pas une de plus</h2>
 * {@code /etat} dit à un client s'il doit proposer « créer le premier compte »
 * ou « se connecter » - et sert de premier appel, celui qui dépose le jeton
 * CSRF. {@code /register} et {@code /login} sont ouverts par
 * nécessité. {@code /visite} l'est pour la même raison qu'un lien de partage :
 * la personne qui entre par là n'a pas de compte, et n'en veut pas. Tout le
 * reste de l'API demande une session, {@code /api/public/**} excepté (voir
 * SecurityConfig).
 *
 * <h2>Une visite est une session, pas une exception</h2>
 * L'alternative aurait été de laisser le client « faire comme si » : appeler
 * l'API en anonyme et masquer les refus. Elle ne tient pas - le cloisonnement
 * de cette application vient de la session (voir {@code ProprietaireCourant}),
 * et sans session un visiteur ne verrait rien du tout, pas même le catalogue.
 * Il en reçoit donc une vraie, qui <b>ne nomme aucun propriétaire</b> et
 * <b>ne peut pas écrire</b>. Ce n'est pas un compte au rabais : c'est le droit
 * de consulter les œuvres que l'instance connaît, et rien de ce que quiconque
 * en a fait.
 *
 * <h2>Ce qu'un échec de connexion ne dit pas</h2>
 * Une adresse inconnue et un mot de passe faux rendent <b>le même</b> 401 et le
 * même message. Distinguer les deux offrirait un test d'existence de compte à
 * qui n'en a pas.
 *
 * <h2>Le pseudo, lui, dit tout</h2>
 * « Ce pseudo est déjà pris » est un 400 explicite, et c'est volontaire : un
 * pseudo est <b>public par destination</b> - il s'affiche sur l'avatar, il se
 * lit dans un espace partagé. Le taire n'apprendrait rien à un curieux et
 * empêcherait la seule personne concernée d'en choisir un autre. Une adresse
 * e-mail, elle, n'est publique nulle part : d'où les deux traitements.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentification", description = "Comptes, connexion, session")
public class AuthController {

    private final AuthService comptes;
    private final AuthenticationManager authentification;
    private final SecurityContextRepository contextes;

    public AuthController(AuthService comptes, AuthenticationManager authentification,
                           SecurityContextRepository contextes) {
        this.comptes = comptes;
        this.authentification = authentification;
        this.contextes = contextes;
    }

    /** L'état d'une instance, pour un client qui ne sait pas encore quoi afficher. */
    public record EtatReponse(boolean aucunCompte, boolean creationOuverte) {
    }

    public record CreationRequete(String email, String motDePasse, String pseudo, String codeInvitation) {
    }

    public record ConnexionRequete(String email, String motDePasse) {
    }

    /**
     * Ce qu'un client apprend d'un compte : jamais le hachage, jamais l'adresse
     * d'un autre.
     *
     * <p>La même forme sert à décrire une VISITE, avec {@code invite} à vrai.
     * Il n'y a alors ni identifiant ni adresse - un visiteur n'est personne -
     * et {@code pseudo} porte le mot sous lequel l'application le nomme. Deux
     * formes séparées auraient obligé chaque écran à demander « lequel des
     * deux ? » avant même de savoir s'il y a quelqu'un.
     */
    public record CompteReponse(UUID id, String email, String pseudo, boolean admin, boolean invite) {
        static CompteReponse de(AppUser compte) {
            return new CompteReponse(compte.id(), compte.email(), compte.pseudo(), compte.admin(), false);
        }

        /** Un visiteur : ni identifiant, ni adresse, ni compte. Juste un mot pour le nommer. */
        static CompteReponse pourUnVisiteur() {
            return new CompteReponse(null, null, "Visiteur", false, true);
        }

        static CompteReponse de(AppUserDetailsService.Principal principal) {
            return new CompteReponse(principal.id(), principal.email(), principal.pseudo(), principal.admin(), false);
        }
    }

    @Operation(summary = "Y a-t-il déjà un compte sur cette instance, et peut-on en créer un ?")
    @GetMapping("/etat")
    public EtatReponse etat() {
        return new EtatReponse(comptes.aucunCompte(), comptes.creationOuverte());
    }

    @Operation(summary = "Créer un compte. Libre tant qu'aucun n'existe (il reprend alors la collection "
            + "déjà en base) ; sur code d'invitation ensuite, et impossible si aucun code n'est configuré.")
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public CompteReponse register(@RequestBody CreationRequete requete, HttpServletRequest requeteHttp,
                                   HttpServletResponse reponseHttp) {
        AppUser compte;
        try {
            compte = comptes.creer(requete.email(), requete.motDePasse(), requete.pseudo(),
                    requete.codeInvitation());
        } catch (AuthService.CreationInterdite interdite) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, interdite.getMessage());
        } catch (AuthService.CreationRefusee refusee) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, refusee.getMessage());
        }
        // Créer son compte connecte : demander de saisir à nouveau ce qu'on
        // vient de taper deux fois n'apprendrait rien à personne.
        ouvrirSession(requete.email(), requete.motDePasse(), requeteHttp, reponseHttp);
        return CompteReponse.de(compte);
    }

    @Operation(summary = "Ouvrir une session. Adresse inconnue et mot de passe faux rendent le même 401.")
    @PostMapping("/login")
    public CompteReponse login(@RequestBody ConnexionRequete requete, HttpServletRequest requeteHttp,
                                HttpServletResponse reponseHttp) {
        return CompteReponse.de(ouvrirSession(requete.email(), requete.motDePasse(), requeteHttp, reponseHttp));
    }

    @Operation(summary = "Consulter le catalogue sans compte. Toujours possible, et la session obtenue ne "
            + "peut que lire : elle ne nomme aucun propriétaire, donc elle ne voit aucune donnée personnelle.")
    @PostMapping("/visite")
    public CompteReponse visiter(HttpServletRequest requeteHttp, HttpServletResponse reponseHttp) {
        // Rien à vérifier, rien à autoriser, personne à désigner. Le visiteur
        // ne présente rien - il n'y a donc pas d'AuthenticationManager à
        // consulter - et il ne demande rien de précis : le catalogue est le
        // même pour tous, et il n'appartient à personne.
        Invite visiteur = new Invite();
        installerDansLaSession(
                new UsernamePasswordAuthenticationToken(visiteur, null, Visite.AUTORITES),
                requeteHttp, reponseHttp);
        return CompteReponse.pourUnVisiteur();
    }

    /**
     * Le principal est lu ici plutôt qu'injecté par {@code @AuthenticationPrincipal} :
     * ce dernier est TYPÉ, et une session de visite n'en porte pas un de ce
     * type - il arrivait donc nul, et un visiteur parfaitement installé se
     * voyait répondre 401 par la seule route censée lui dire qui il est.
     */
    @Operation(summary = "Le compte connecté ou la visite en cours (invite=true), ou 401.")
    @GetMapping("/me")
    public CompteReponse me(Authentication authentifie) {
        Object qui = authentifie == null ? null : authentifie.getPrincipal();
        if (qui instanceof Invite) {
            return CompteReponse.pourUnVisiteur();
        }
        if (qui instanceof AppUserDetailsService.Principal principal) {
            return CompteReponse.de(principal);
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    @Operation(summary = "Fermer la session.")
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest requeteHttp) {
        HttpSession session = requeteHttp.getSession(false);
        if (session != null) {
            // Invalider la session, et pas seulement vider le contexte : une
            // session qui survit garde son identifiant, donc reste rejouable.
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    /**
     * Authentifie, puis ÉCRIT le contexte dans la session.
     * <p>
     * Depuis Spring Security 6, poser l'authentification dans le
     * {@link SecurityContextHolder} ne suffit plus : sans écriture explicite,
     * elle disparaît à la fin de la requête et l'appel suivant repart en 401 -
     * une connexion qui « marche » sans jamais connecter.
     */
    private AppUserDetailsService.Principal ouvrirSession(String email, String motDePasse,
                                                           HttpServletRequest requeteHttp,
                                                           HttpServletResponse reponseHttp) {
        Authentication authentifie;
        try {
            authentifie = authentification.authenticate(
                    new UsernamePasswordAuthenticationToken(AppUser.normaliserEmail(email), motDePasse));
        } catch (AuthenticationException echec) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Adresse ou mot de passe incorrect.");
        }
        installerDansLaSession(authentifie, requeteHttp, reponseHttp);
        return (AppUserDetailsService.Principal) authentifie.getPrincipal();
    }

    /**
     * Session neuve, puis contexte écrit dedans - le geste commun à toutes les
     * façons d'entrer.
     * <p>
     * Neuve à chaque fois : un identifiant de session obtenu AVANT d'entrer ne
     * doit jamais devenir une session installée (fixation de session). Cela
     * vaut aussi pour une visite - c'est une session comme une autre, et
     * l'oublier là aurait rouvert le trou refermé sur la connexion.
     */
    private void installerDansLaSession(Authentication authentifie, HttpServletRequest requeteHttp,
                                         HttpServletResponse reponseHttp) {
        HttpSession ancienne = requeteHttp.getSession(false);
        if (ancienne != null) {
            ancienne.invalidate();
        }
        requeteHttp.getSession(true);

        SecurityContext contexte = SecurityContextHolder.createEmptyContext();
        contexte.setAuthentication(authentifie);
        SecurityContextHolder.setContext(contexte);
        contextes.saveContext(contexte, requeteHttp, reponseHttp);
    }
}
