package com.iozycore.core.api.auth;

import com.iozycore.core.application.auth.AccountProfile;
import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.auth.AuthService;
import com.iozycore.core.application.auth.Invite;
import com.iozycore.core.application.auth.Visite;
import com.iozycore.core.domain.user.AccountPreferences;
import com.iozycore.core.domain.user.AppUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
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
@RequiredArgsConstructor
public class AuthController {

    private final AuthService comptes;
    private final AuthenticationManager authentification;
    private final SecurityContextRepository contextes;
    private final FailedAttemptThrottle throttle;
    private final AccountProfile profile;

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
    public record CompteReponse(UUID id, String email, String pseudo, boolean admin, boolean invite,
                                PreferencesDto preferences) {
        static CompteReponse de(AppUser compte) {
            return new CompteReponse(compte.id(), compte.email(), compte.pseudo(), compte.admin(), false, null);
        }

        /**
         * The account with its preferences (lot 218): what {@code GET /me} and
         * {@code PATCH /me} answer. The other routes leave {@code preferences}
         * null: "not said here", which a client tells from "nothing chosen"
         * (an object whose fields are null).
         */
        static CompteReponse de(AppUser compte, AccountPreferences preferences) {
            return new CompteReponse(compte.id(), compte.email(), compte.pseudo(), compte.admin(), false,
                    PreferencesDto.from(preferences));
        }

        /** A visitor: no id, no address, no account. Just a word to name them. */
        static CompteReponse pourUnVisiteur() {
            return new CompteReponse(null, null, "Visiteur", false, true, null);
        }

        static CompteReponse de(AppUserDetailsService.Principal principal) {
            return new CompteReponse(principal.id(), principal.email(), principal.pseudo(), principal.admin(), false,
                    null);
        }
    }

    /**
     * A change of the common profile. Every field is optional: null keeps
     * what the account has.
     */
    public record UpdateRequest(String pseudo, PreferencesDto preferences) {
    }

    /**
     * The preferences of an account, for both apps. A null field: never
     * chosen on the account, the client keeps its local setting.
     *
     * @param accent           {@code AUTO} (the cover colors) or {@code TERRACOTTA}
     * @param appearance       {@code SYSTEM}, {@code DARK} or {@code LIGHT}
     * @param titleComposition the three title languages, in order
     * @param blindtestSound   the IozyTest sound effects
     */
    public record PreferencesDto(String accent, String appearance, List<TitleChoiceDto> titleComposition,
                                 SoundDto blindtestSound) {

        static PreferencesDto from(AccountPreferences preferences) {
            return new PreferencesDto(
                    preferences.accent() == null ? null : preferences.accent().name(),
                    preferences.appearance() == null ? null : preferences.appearance().name(),
                    preferences.titleComposition() == null ? null : preferences.titleComposition().stream()
                            .map(c -> new TitleChoiceDto(c.language().name(), c.enabled())).toList(),
                    preferences.blindtestSound() == null ? null
                            : new SoundDto(preferences.blindtestSound().enabled(),
                            preferences.blindtestSound().volume()));
        }

        /** @throws IllegalArgumentException a value the account cannot hold (400, with the reason) */
        AccountPreferences toDomain() {
            return new AccountPreferences(
                    accent == null ? null : AccountPreferences.Accent.parse(accent),
                    appearance == null ? null : AccountPreferences.Appearance.parse(appearance),
                    titleComposition == null ? null : titleComposition.stream().map(TitleChoiceDto::toDomain).toList(),
                    blindtestSound == null ? null : blindtestSound.toDomain());
        }
    }

    public record TitleChoiceDto(String language, Boolean enabled) {
        AccountPreferences.TitleChoice toDomain() {
            if (enabled == null) {
                throw new IllegalArgumentException("Chaque langue de titre doit dire si elle est cochée.");
            }
            return new AccountPreferences.TitleChoice(AccountPreferences.TitleLanguage.parse(language), enabled);
        }
    }

    public record SoundDto(Boolean enabled, Integer volume) {
        AccountPreferences.BlindtestSound toDomain() {
            if (enabled == null || volume == null) {
                throw new IllegalArgumentException("Le son du blindtest se règle en entier : activé et volume.");
            }
            return new AccountPreferences.BlindtestSound(enabled, volume);
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
        String inviteKey = "invite|" + requeteHttp.getRemoteAddr();
        if (!throttle.tryAcquire(inviteKey)) {
            throw tooManyAttempts();
        }
        AppUser compte;
        boolean wrongCodeGiven = false;
        try {
            compte = comptes.creer(requete.email(), requete.motDePasse(), requete.pseudo(),
                    requete.codeInvitation());
        } catch (AuthService.InvalidInviteCode wrongCode) {
            wrongCodeGiven = true;
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, wrongCode.getMessage());
        } catch (AuthService.CreationInterdite interdite) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, interdite.getMessage());
        } catch (AuthService.CreationRefusee refusee) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, refusee.getMessage());
        } finally {
            // Only a wrong code is a guess; any other outcome gives the attempt back.
            if (!wrongCodeGiven) {
                throttle.release(inviteKey);
            }
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
        String loginKey = "login|" + emailForKey(requete.email()) + "|" + requeteHttp.getRemoteAddr();
        if (!throttle.tryAcquire(loginKey)) {
            throw tooManyAttempts();
        }
        AppUserDetailsService.Principal principal;
        try {
            principal = ouvrirSession(requete.email(), requete.motDePasse(), requeteHttp, reponseHttp);
        } catch (ResponseStatusException refused) {
            // A refused password: the attempt stays counted.
            throw refused;
        } catch (RuntimeException notAGuess) {
            throttle.release(loginKey);
            throw notAGuess;
        }
        throttle.recordSuccess(loginKey);
        return CompteReponse.de(principal);
    }

    /**
     * The address as it goes into a throttle key. Capped, so that a flood of
     * huge addresses cannot fill memory: no real address is longer (RFC 5321).
     */
    private static String emailForKey(String email) {
        String normalized = AppUser.normaliserEmail(email);
        return normalized.length() > 254 ? normalized.substring(0, 254) : normalized;
    }

    private static ResponseStatusException tooManyAttempts() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Trop de tentatives. Réessayez dans quelques minutes.");
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
    @Operation(summary = "The signed-in account with its preferences, or the current visit (invite=true), or 401.")
    @GetMapping("/me")
    public CompteReponse me(Authentication authentifie) {
        Object qui = authentifie == null ? null : authentifie.getPrincipal();
        if (qui instanceof Invite) {
            return CompteReponse.pourUnVisiteur();
        }
        if (qui instanceof AppUserDetailsService.Principal principal) {
            // Read again, not taken from the session: the pseudo can change
            // after sign-in (lot 218), from this tab or from another one.
            return CompteReponse.de(profile.account(principal.id()), profile.preferences());
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    /**
     * Changes the pseudo and the preferences of the signed-in account (lot
     * 218). A visit is refused before reaching here (read-only, see
     * SecurityConfig).
     */
    @Operation(summary = "Change the pseudo and/or the preferences of the signed-in account. "
            + "Null fields are kept. 400 with the reason for a bad or taken pseudo or a bad value.")
    @PatchMapping("/me")
    public CompteReponse update(@RequestBody UpdateRequest requete, Authentication authentifie,
                                HttpServletRequest requeteHttp, HttpServletResponse reponseHttp) {
        if (!(authentifie != null && authentifie.getPrincipal() instanceof AppUserDetailsService.Principal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        AccountPreferences change = requete == null || requete.preferences() == null
                ? null
                : requete.preferences().toDomain();
        AppUser compte = profile.update(principal.id(), requete == null ? null : requete.pseudo(), change);
        if (!compte.pseudo().equals(principal.pseudo())) {
            // The session keeps the principal written at sign-in: it gets the
            // new pseudo too, so nothing reads the old one later.
            var renomme = new AppUserDetailsService.Principal(principal.id(), principal.email(),
                    principal.motDePasseHache(), compte.pseudo(), principal.admin());
            SecurityContext contexte = SecurityContextHolder.createEmptyContext();
            contexte.setAuthentication(new UsernamePasswordAuthenticationToken(renomme, null,
                    authentifie.getAuthorities()));
            SecurityContextHolder.setContext(contexte);
            contextes.saveContext(contexte, requeteHttp, reponseHttp);
        }
        return CompteReponse.de(compte, profile.preferences());
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
