package com.iozycore.core.api.config;

import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.auth.Invite;
import com.iozycore.core.domain.user.AppUserRepository;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * The door of the application.
 *
 * <h2>What stays open, and why</h2>
 * Only three paths: the <b>creation of the first account</b> and
 * <b>sign-in</b> (otherwise nobody could ever enter), and
 * <b>{@code /api/public/**}</b> - the share links, whose whole
 * purpose it is: a visitor who is sent a link has no account.
 * Their filtering is done on the server side and covered by a test that looks for
 * private data in the serialized response.
 *
 * <p>Everything else asks for a session, <b>Swagger included</b>. An
 * API documentation that declares 92 routes is also a map: it
 * brings nothing to whoever has no right to call them. One signs in
 * first, the session is valid for Swagger as for the app.
 *
 * <h2>A session, not a token in the browser</h2>
 * An {@code HttpOnly} cookie cannot be read by JavaScript; a token
 * stored in {@code localStorage} can be read by any injected script.
 * And the architecture of this repository already serves the API under the SAME origin as
 * the app (Vite proxy in development, nginx in production, see
 * web/README.md): the cookie therefore travels without cross-site configuration.
 *
 * <p>Accepted consequence: sessions live in memory, a restart of the
 * server signs everyone out. On a personal collection
 * application, signing in again after an update is an acceptable price -
 * much more than the dependency that a shared session store would add.
 *
 * <h2>Visitor mode: the same chain, minus the right to write</h2>
 * A visitor ({@code /api/auth/visite}) has a session like the others, and
 * this is what lets them read the <b>catalog</b> - an anonymous user would
 * see nothing at all. This session names <b>no owner</b>:
 * it therefore gives access to the works, which belong to nobody, and to
 * no ownership, rating or wish, all filtered by owner (see
 * {@code Invite}).
 *
 * <p>What they do not have is the right to write, and this refusal is set <b>by the
 * HTTP method</b>, once and for all, in {@link LectureSeuleInvite}:
 * everything that is not a {@code GET} is closed to them.
 *
 * <p>By the method, and not route by route: a list of forbidden routes
 * goes stale at the first controller added, and the omission cannot be seen - it
 * writes into someone else's database. A {@code POST} that would only
 * read (some exist: analyze a listing, read a link) falls under the same
 * refusal, and that is fine: these are precisely the costly, outgoing or
 * billed calls that a door open to the whole Internet must not offer.
 *
 * <h2>A session is only valid as long as its account exists</h2>
 * The session keeps the principal written at sign-in, and nothing read it again
 * afterwards: an account deleted by the administrator stayed "signed in" in
 * its browser. {@link SessionDUnCompteSupprime} reads the account again at each
 * request and closes the session as soon as it is gone.
 *
 * <h2>CSRF: enabled, because the cookie travels on its own</h2>
 * This is the exact counterpart of the previous choice. A session cookie goes
 * automatically with the request, even when ANOTHER page triggers
 * it - this is the definition of a CSRF. The token is set in a
 * cookie readable by the client (see {@link CookieCsrfTokenRepository}), which
 * {@code web/src/api/client.ts} sends back as a header on any write. A third-party
 * page cannot read this cookie, so it cannot forge the header.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * The CSRF token is <b>deferred</b> since Spring Security 6: the cookie
     * is only written if someone reads the token during the request. Without this
     * filter, a client that only did GETs would never have received a
     * cookie, and its first write would be refused - including the sign-in
     * itself, the very first call of a session.
     */
    static class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            CsrfToken jeton = (CsrfToken) request.getAttribute("_csrf");
            if (jeton != null) {
                jeton.getToken();
            }
            chain.doFilter(request, response);
        }
    }

    /**
     * A visitor reads, and nothing else.
     *
     * <h2>Why a filter rather than an authorization rule</h2>
     * The rules of {@code authorizeHttpRequests} are read in order and the
     * FIRST one that matches wins. A rule "everything that is not a GET
     * is forbidden to guests", put at the top, would have short-circuited
     * all the following ones - {@code /api/admin/**}, {@code /api/tags/**}, the
     * sign-in itself - for all visitors, guests or not. Put at the
     * bottom, it would never have been reached, {@code anyRequest} having already
     * decided. The refusal does not stack on the existing rules: it comes
     * AFTER them, on the request that they let through.
     *
     * <h2>Sign-out stays open</h2>
     * It is a {@code POST}, and it is the only action of a guest that must
     * succeed: refusing them the exit would lock them in the collection of
     * someone else until their session expires.
     *
     * <h2>The body is written here, in full</h2>
     * {@code sendError} would have returned the Spring error page, whose
     * detailed message is silenced as long as {@code server.error.include-message}
     * is not set - which it is not here. The visitor would have read
     * "Accès refusé", the generic fallback of the client, instead of the only
     * useful thing: it is the visit that is read-only, they did not
     * make a mistake. The shape {@code {"error": ...}} is the one the client
     * reads first (see {@code web/src/api/client.ts}).
     */
    static class LectureSeuleInvite extends OncePerRequestFilter {

        private static final String SORTIE = "/api/auth/logout";

        @Override
        protected void doFilterInternal(HttpServletRequest requete, HttpServletResponse reponse, FilterChain chaine)
                throws ServletException, IOException {
            // Signing out stays possible: it is the only action of a visitor that
            // must succeed, otherwise they would keep a cookie that became useless.
            if (!estUnVisiteur() || SORTIE.equals(requete.getRequestURI())) {
                chaine.doFilter(requete, reponse);
                return;
            }
            if (!"GET".equals(requete.getMethod())) {
                reponse.setStatus(HttpStatus.FORBIDDEN.value());
                reponse.setContentType("application/json;charset=UTF-8");
                reponse.getWriter().write(
                        "{\"error\":\"Tu consultes le catalogue en lecture seule. "
                                + "Il faut un compte pour enregistrer quoi que ce soit.\"}");
                return;
            }
            chaine.doFilter(requete, reponse);
        }

        private static boolean estUnVisiteur() {
            var authentification = SecurityContextHolder.getContext().getAuthentication();
            return authentification != null && authentification.getPrincipal() instanceof Invite;
        }
    }

    /**
     * A deleted account does not keep its session.
     *
     * <h2>The hole this filter closes</h2>
     * The session keeps the principal written at sign-in - id,
     * address, role - and nothing read it again afterwards. Deleting an account
     * (see {@code GestionDesComptes}) erased its data and its row, but
     * its browser stayed "signed in": an empty collection, and
     * writes that would have gone out again under an id that nobody
     * carries anymore. Found by the Playwright import path (batch 135), which
     * deletes an account and waits at the door.
     *
     * <h2>One primary key per request, rather than a session registry</h2>
     * Spring Security knows how to expire the sessions of a principal, provided
     * they are registered on entry and an in-memory registry is kept - which does not
     * survive a restart, and which a session store added one day
     * would not see. Here, one read by primary key of the accounts
     * table, on each request that carries one: the price of a stateless
     * rule, and it stays true whatever the shape of the session. A
     * visit is not concerned, it names no account.
     *
     * <p>Before authorization, because it is a question of it: a session
     * that designates nobody anymore is not authenticated. It answers 401
     * as if it did not exist - which the client translates into a door - and
     * it is invalidated, so it cannot be replayed.
     */
    static class SessionDUnCompteSupprime extends OncePerRequestFilter {

        private final AppUserRepository comptes;

        SessionDUnCompteSupprime(AppUserRepository comptes) {
            this.comptes = comptes;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest requete, HttpServletResponse reponse, FilterChain chaine)
                throws ServletException, IOException {
            var authentification = SecurityContextHolder.getContext().getAuthentication();
            if (authentification != null
                    && authentification.getPrincipal() instanceof AppUserDetailsService.Principal principal
                    && comptes.findById(principal.id()).isEmpty()) {
                HttpSession session = requete.getSession(false);
                if (session != null) {
                    session.invalidate();
                }
                SecurityContextHolder.clearContext();
                reponse.setStatus(HttpStatus.UNAUTHORIZED.value());
                reponse.setContentType("application/json;charset=UTF-8");
                reponse.getWriter().write("{\"error\":\"Ce compte n'existe plus.\"}");
                return;
            }
            chaine.doFilter(requete, reponse);
        }
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // BCrypt, default strength (10): slow on purpose, and the only cost is
        // that of a sign-in - a handful per day on this application.
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        // Explicit because the sign-in controller uses it directly:
        // since Spring Security 6, authenticating is no longer enough to remember, the
        // context must be written into the session by hand.
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public AuthenticationManager authenticationManager(AppUserDetailsService comptes, PasswordEncoder encodeur) {
        DaoAuthenticationProvider fournisseur = new DaoAuthenticationProvider();
        fournisseur.setUserDetailsService(comptes);
        fournisseur.setPasswordEncoder(encodeur);
        // Without it, an unknown address fails faster than a wrong
        // password: the response time would tell an attacker which addresses
        // exist. The provider then compares against a dummy hash.
        fournisseur.setHideUserNotFoundExceptions(true);
        return new org.springframework.security.authentication.ProviderManager(fournisseur);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, SecurityContextRepository contextes,
                                           AppUserRepository comptes) throws Exception {
        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        // The DEFAULT handler masks the token (BREACH
                        // protection): it expects back the masked value that it
                        // exposed in the page, not the one of the cookie. A client that
                        // reads the cookie therefore sends back a value that unmasking
                        // rejects - 403 on every write, including the first
                        // sign-in (seen live). Masking has nothing to protect here
                        // anyway: the token is already in a readable
                        // cookie, this is the very principle of the setup.
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .addFilterAfter(new CsrfCookieFilter(), UsernamePasswordAuthenticationFilter.class)
                // BEFORE authorization: a session whose account is gone
                // is no longer a session, and is handled as an absence of
                // session (see the javadoc of the filter).
                .addFilterBefore(new SessionDUnCompteSupprime(comptes), AuthorizationFilter.class)
                // AFTER authorization: the refusal only applies to the requests
                // that the rules below already accepted (see the javadoc
                // of the filter).
                .addFilterAfter(new LectureSeuleInvite(), AuthorizationFilter.class)
                // The existing CORS configuration (see CorsConfig) only applies
                // if the security chain consults it.
                .cors(org.springframework.security.config.Customizer.withDefaults())
                .securityContext(contexte -> contexte.securityContextRepository(contextes))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(routes -> routes
                        // The error page is not a route: it is the
                        // RENDERING of a request already decided by the rules
                        // below. Since Spring Security 6, the chain
                        // also applies to this internal redirect: without
                        // this line, a 404 meant for an anonymous visitor
                        // went back to 401 - seen live on a share
                        // link, while the MockMvc tests, which do not
                        // replay this redirect, said 404.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/etat").permitAll()
                        // Entering without an account, when someone opened their
                        // collection to visitors. Closed by default, and the
                        // controller refuses when nobody opened anything -
                        // "permitAll" opens the route, not the door.
                        .requestMatchers("/api/auth/visite").permitAll()
                        // The share links: their recipient has no account.
                        .requestMatchers("/api/public/**").permitAll()
                        // The administration of the INSTANCE - who has an account, and
                        // deleting one. Declared BEFORE `anyRequest`, otherwise
                        // "authenticated" would be enough: the first rule
                        // that matches wins. Nothing here opens the data
                        // of others, which stays filtered by owner.
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // Tags describe a WORK, not a collection:
                        // they live in the SHARED catalog, like the
                        // categories and the reference editions. Everyone
                        // READS them - this is what makes the filter of My
                        // collection usable - and only an administrator
                        // sets, renames or removes them. Without this
                        // rule, any account would tag the works
                        // of all the others.
                        .requestMatchers(HttpMethod.GET, "/api/tags/**").authenticated()
                        .requestMatchers("/api/tags/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                // An API answers 401, it does not redirect to a
                // sign-in page: the client decides what to show.
                .exceptionHandling(erreurs -> erreurs.authenticationEntryPoint(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable());
        return http.build();
    }
}
