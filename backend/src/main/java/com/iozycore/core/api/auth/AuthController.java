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
 * Sign in, sign out, and know who you are.
 *
 * <h2>Four open routes, and not one more</h2>
 * {@code /etat} tells a client whether it should offer "create the first account"
 * or "sign in" - and serves as the first call, the one that sets the CSRF
 * token. {@code /register} and {@code /login} are open by
 * necessity. {@code /visite} is for the same reason as a share link:
 * the person who comes in this way has no account, and does not want one. All the
 * rest of the API asks for a session, {@code /api/public/**} excepted (see
 * SecurityConfig).
 *
 * <h2>A visit is a session, not an exception</h2>
 * The alternative would have been to let the client "pretend": call
 * the API anonymously and hide the refusals. It does not hold - the partitioning
 * of this application comes from the session (see {@code ProprietaireCourant}),
 * and without a session a visitor would see nothing at all, not even the catalog.
 * It therefore receives a real one, which <b>names no owner</b> and
 * <b>cannot write</b>. It is not a cut-price account: it is the right
 * to browse the works that the instance knows, and nothing of what anyone
 * made of them.
 *
 * <h2>What a failed sign-in does not say</h2>
 * An unknown address and a wrong password return <b>the same</b> 401 and the
 * same message. Telling the two apart would offer an account existence test to
 * someone who has none.
 *
 * <h2>The pseudo, on the other hand, says everything</h2>
 * "Ce pseudo est déjà pris" is an explicit 400, and this is on purpose: a
 * pseudo is <b>public by design</b> - it is shown on the avatar, it is
 * read in a shared space. Hiding it would teach nothing to a curious person and
 * would stop the only person concerned from choosing another one. An e-mail
 * address is public nowhere: hence the two treatments.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Accounts, sign-in, session")
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

    /** The state of an instance, for a client that does not yet know what to show. */
    public record EtatReponse(boolean aucunCompte, boolean creationOuverte) {
    }

    public record CreationRequete(String email, String motDePasse, String pseudo, String codeInvitation) {
    }

    public record ConnexionRequete(String email, String motDePasse) {
    }

    /**
     * What a client learns about an account: never the hash, never the address
     * of another.
     *
     * <p>The same shape describes a VISIT, with {@code invite} true.
     * There is then no id and no address - a visitor is nobody -
     * and {@code pseudo} carries the word under which the application names them. Two
     * separate shapes would have forced each screen to ask "which of the
     * two?" before even knowing whether there is someone.
     */
    public record CompteReponse(UUID id, String email, String pseudo, boolean admin, boolean invite) {
        static CompteReponse de(AppUser compte) {
            return new CompteReponse(compte.id(), compte.email(), compte.pseudo(), compte.admin(), false);
        }

        /** A visitor: no id, no address, no account. Just a word to name them. */
        static CompteReponse pourUnVisiteur() {
            return new CompteReponse(null, null, "Visiteur", false, true);
        }

        static CompteReponse de(AppUserDetailsService.Principal principal) {
            return new CompteReponse(principal.id(), principal.email(), principal.pseudo(), principal.admin(), false);
        }
    }

    @Operation(summary = "Is there already an account on this instance, and can one be created?")
    @GetMapping("/etat")
    public EtatReponse etat() {
        return new EtatReponse(comptes.aucunCompte(), comptes.creationOuverte());
    }

    @Operation(summary = "Create an account. Free as long as none exists (it then takes over the collection "
            + "already in the database); with an invitation code afterwards, and impossible if no code is configured.")
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
        // Creating one's account signs in: asking to type again what one
        // just typed twice would teach nothing to anyone.
        ouvrirSession(requete.email(), requete.motDePasse(), requeteHttp, reponseHttp);
        return CompteReponse.de(compte);
    }

    @Operation(summary = "Open a session. An unknown address and a wrong password return the same 401.")
    @PostMapping("/login")
    public CompteReponse login(@RequestBody ConnexionRequete requete, HttpServletRequest requeteHttp,
                                HttpServletResponse reponseHttp) {
        return CompteReponse.de(ouvrirSession(requete.email(), requete.motDePasse(), requeteHttp, reponseHttp));
    }

    @Operation(summary = "Browse the catalog without an account. Always possible, and the session obtained can "
            + "only read: it names no owner, so it sees no personal data.")
    @PostMapping("/visite")
    public CompteReponse visiter(HttpServletRequest requeteHttp, HttpServletResponse reponseHttp) {
        // Nothing to check, nothing to authorize, nobody to designate. The visitor
        // presents nothing - so there is no AuthenticationManager to
        // consult - and asks for nothing specific: the catalog is the
        // same for everyone, and it belongs to nobody.
        Invite visiteur = new Invite();
        installerDansLaSession(
                new UsernamePasswordAuthenticationToken(visiteur, null, Visite.AUTORITES),
                requeteHttp, reponseHttp);
        return CompteReponse.pourUnVisiteur();
    }

    /**
     * The principal is read here rather than injected by {@code @AuthenticationPrincipal}:
     * the latter is TYPED, and a visit session does not carry one of this
     * type - so it arrived null, and a perfectly set up visitor
     * got a 401 from the only route meant to tell them who they are.
     */
    @Operation(summary = "The signed-in account or the current visit (invite=true), or 401.")
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

    @Operation(summary = "Close the session.")
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletRequest requeteHttp) {
        HttpSession session = requeteHttp.getSession(false);
        if (session != null) {
            // Invalidate the session, and not only clear the context: a
            // session that survives keeps its id, so it stays replayable.
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    /**
     * Authenticates, then WRITES the context into the session.
     * <p>
     * Since Spring Security 6, putting the authentication in the
     * {@link SecurityContextHolder} is no longer enough: without an explicit write,
     * it disappears at the end of the request and the next call is back to 401 -
     * a sign-in that "works" without ever signing in.
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
     * New session, then context written into it - the move common to all the
     * ways of entering.
     * <p>
     * New every time: a session id obtained BEFORE entering must
     * never become an installed session (session fixation). This
     * also holds for a visit - it is a session like any other, and
     * forgetting it there would have reopened the hole closed on sign-in.
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
