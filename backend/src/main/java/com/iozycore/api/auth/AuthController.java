package com.iozycore.api.auth;

import com.iozycore.application.auth.AppUserDetailsService;
import com.iozycore.application.auth.AuthService;
import com.iozycore.application.auth.Invite;
import com.iozycore.application.auth.Visite;
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
 * {@code /etat} dit à un client s'il doit proposer « créer le premier compte »,
 * « se connecter » ou « visiter » - et sert de premier appel, celui qui dépose
 * le jeton CSRF. {@code /register} et {@code /login} sont ouverts par
 * nécessité. {@code /visite} l'est pour la même raison qu'un lien de partage :
 * la personne qui entre par là n'a pas de compte, et n'en veut pas. Tout le
 * reste de l'API demande une session, {@code /api/public/**} excepté (voir
 * SecurityConfig).
 *
 * <h2>Une visite est une session, pas une exception</h2>
 * L'alternative aurait été de laisser le client « faire comme si » : appeler
 * l'API en anonyme et masquer les refus. Elle ne tient pas - le cloisonnement
 * de cette application vient de la session (voir {@code ProprietaireCourant}),
 * et sans session un visiteur ne verrait rien du tout. Il en reçoit donc une
 * vraie, qui nomme la collection visitée et <b>ne peut pas écrire</b> (voir
 * {@code SecurityConfig}). Ce n'est pas un compte au rabais : c'est un droit de
 * lecture chez quelqu'un, et ça se referme d'un côté comme de l'autre - le
 * visiteur se déconnecte, l'hôte décoche la case.
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
    private final Visite visites;
    private final AuthenticationManager authentification;
    private final SecurityContextRepository contextes;

    public AuthController(AuthService comptes, Visite visites, AuthenticationManager authentification,
                           SecurityContextRepository contextes) {
        this.comptes = comptes;
        this.visites = visites;
        this.authentification = authentification;
        this.contextes = contextes;
    }

    /** L'état d'une instance, pour un client qui ne sait pas encore quoi afficher. */
    public record EtatReponse(boolean aucunCompte, boolean creationOuverte, boolean visiteOuverte) {
    }

    public record CreationRequete(String email, String motDePasse, String pseudo, String codeInvitation) {
    }

    public record ConnexionRequete(String email, String motDePasse) {
    }

    /**
     * Ce qu'un client apprend d'un compte : jamais le hachage, jamais l'adresse
     * d'un autre.
     *
     * <p>La même forme sert à décrire une VISITE, avec {@code invite} à vrai :
     * {@code id} est alors la collection parcourue et {@code pseudo} le nom de
     * son hôte, tandis que {@code email} reste nul - un visiteur n'a pas
     * d'adresse ici, et celle de l'hôte ne le regarde pas. Deux formes séparées
     * auraient obligé chaque écran à demander « lequel des deux ? » avant même
     * de savoir s'il y a quelqu'un.
     */
    public record CompteReponse(UUID id, String email, String pseudo, boolean admin, boolean invite) {
        static CompteReponse de(AppUser compte) {
            return new CompteReponse(compte.id(), compte.email(), compte.pseudo(), compte.admin(), false);
        }

        static CompteReponse de(Invite visiteur) {
            return new CompteReponse(visiteur.proprietaire(), null, visiteur.hote(), false, true);
        }

        static CompteReponse de(AppUserDetailsService.Principal principal) {
            return new CompteReponse(principal.id(), principal.email(), principal.pseudo(), principal.admin(), false);
        }
    }

    @Operation(summary = "Y a-t-il déjà un compte sur cette instance, peut-on en créer un, "
            + "et une collection est-elle ouverte aux visiteurs ?")
    @GetMapping("/etat")
    public EtatReponse etat() {
        return new EtatReponse(comptes.aucunCompte(), comptes.creationOuverte(), visites.ouverte());
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

    @Operation(summary = "Entrer en visiteur, sans compte, sur la collection dont le propriétaire a ouvert "
            + "les portes. 403 si personne n'en a ouvert. La session obtenue ne peut que lire.")
    @PostMapping("/visite")
    public CompteReponse visiter(HttpServletRequest requeteHttp, HttpServletResponse reponseHttp) {
        Invite visiteur = visites.commencer().orElseThrow(() -> new ResponseStatusException(
                HttpStatus.FORBIDDEN, "Aucune collection n'est ouverte aux visiteurs sur cette instance."));
        // Le visiteur ne présente RIEN : il n'y a donc rien à authentifier, et
        // aucun AuthenticationManager à consulter. L'autorisation vient de
        // l'instance, qui a déjà répondu ci-dessus ; il ne reste qu'à écrire
        // dans la session qui il est - et ce qu'il n'est pas.
        installerDansLaSession(
                new UsernamePasswordAuthenticationToken(visiteur, null, Visite.AUTORITES),
                requeteHttp, reponseHttp);
        return CompteReponse.de(visiteur);
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
        if (qui instanceof Invite visiteur) {
            return CompteReponse.de(visiteur);
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
