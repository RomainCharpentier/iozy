package com.iozycore.api.auth;

import com.iozycore.application.auth.AppUserDetailsService;
import com.iozycore.application.auth.AuthService;
import com.iozycore.domain.user.AppUser;
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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
 * <h2>Trois routes ouvertes, et pas une de plus</h2>
 * {@code /etat} dit à un client s'il doit proposer « créer le premier compte »
 * ou « se connecter » - et sert de premier appel, celui qui dépose le jeton
 * CSRF. {@code /register} et {@code /login} sont ouverts par nécessité. Tout le
 * reste de l'API demande une session, {@code /api/public/**} excepté (voir
 * SecurityConfig).
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

    /** Ce qu'un client apprend d'un compte : jamais le hachage, jamais l'adresse d'un autre. */
    public record CompteReponse(UUID id, String email, String pseudo, boolean admin) {
        static CompteReponse de(AppUser compte) {
            return new CompteReponse(compte.id(), compte.email(), compte.pseudo(), compte.admin());
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
        AppUserDetailsService.Principal principal =
                ouvrirSession(requete.email(), requete.motDePasse(), requeteHttp, reponseHttp);
        return new CompteReponse(principal.id(), principal.email(), principal.pseudo(), principal.admin());
    }

    @Operation(summary = "Le compte connecté, ou 401.")
    @GetMapping("/me")
    public CompteReponse me(@AuthenticationPrincipal AppUserDetailsService.Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return new CompteReponse(principal.id(), principal.email(), principal.pseudo(), principal.admin());
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
        // Session neuve à chaque connexion : un identifiant de session obtenu
        // AVANT de se connecter ne doit jamais devenir une session connectée
        // (fixation de session).
        HttpSession ancienne = requeteHttp.getSession(false);
        if (ancienne != null) {
            ancienne.invalidate();
        }
        requeteHttp.getSession(true);

        SecurityContext contexte = SecurityContextHolder.createEmptyContext();
        contexte.setAuthentication(authentifie);
        SecurityContextHolder.setContext(contexte);
        contextes.saveContext(contexte, requeteHttp, reponseHttp);
        return (AppUserDetailsService.Principal) authentifie.getPrincipal();
    }
}
